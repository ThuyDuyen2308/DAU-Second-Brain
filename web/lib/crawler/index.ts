// web/lib/crawler/index.ts
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/db";
import { CrawlStatus, SourceType } from "@prisma/client";

export interface CrawlJobOptions {
  maxPages?: number;
  dryRun?: boolean;
  sourceUrl?: string;
  userId: string;
}

export interface CrawlJobSummary {
  status: string;
  source_url: string;
  max_pages: number;
  is_dry_run: boolean;
  pages_scanned: number;
  items_found: number;
  new_items: number;
  duplicate_items: number;
  likely_duplicate_items: number;
  failed_items: number;
  downloaded_files: number;
  skipped_files: number;
  error_message: string | null;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  items: Array<{
    title: string;
    document_number: string | null;
    published_date: string | null;
    detail_url: string;
    attachments: string[];
    duplicate_status: "NEW" | "EXACT_DUPLICATE" | "LIKELY_DUPLICATE";
    duplicate_reason: string;
    source_page: number;
  }>;
  downloaded_documents: Array<{
    source_type: string;
    source_url: string;
    detail_url: string;
    title: string | null;
    document_number: string | null;
    published_date: string | null;
    file_info: {
      success: boolean;
      storage_path: string;
      full_path: string;
      filename: string;
      checksum: string;
      size_bytes: number;
      mime_type: string;
      file_format: string;
    };
  }>;
}

/**
 * Thực thi tiến trình Python crawler độc lập và lưu kết quả vào PostgreSQL
 */
export async function executeCrawlJob(options: CrawlJobOptions) {
  const maxPages = options.maxPages || 5;
  const isDryRun = !!options.dryRun;
  const sourceUrl =
    options.sourceUrl ||
    process.env.DAU_CRAWLER_SOURCE_URL ||
    process.env.CRAWLER_SOURCE_URL ||
    "https://sinhvien.dau.edu.vn/sinh-vien/dm-tin/thong-bao.html";

  // 1. Khởi tạo bản ghi CrawlJob trong DB
  const job = await prisma.crawlJob.create({
    data: {
      status: CrawlStatus.RUNNING,
      sourceUrl,
      maxPages,
      isDryRun,
      startedAt: new Date(),
    },
  });

  // 2. Lấy danh sách checksums và urls hiện có trong DB để chống trùng lặp
  const existingDocs = await prisma.importedDocument.findMany({
    select: { checksum: true, detailUrl: true, sourceUrl: true },
  });

  const knownChecksums = existingDocs.map((d) => d.checksum).filter(Boolean);
  const knownUrls = existingDocs
    .map((d) => d.detailUrl || d.sourceUrl)
    .filter((u): u is string => !!u && u.trim().length > 0);

  // 3. Chuẩn bị chạy CLI Python
  const pythonScript = path.resolve(process.cwd(), "../crawler/run_crawler_cli.py");
  const args = [
    pythonScript,
    "--max-pages",
    String(maxPages),
    "--source-url",
    sourceUrl,
  ];

  if (isDryRun) {
    args.push("--dry-run");
  }

  if (knownChecksums.length > 0) {
    args.push("--known-checksums", JSON.stringify(knownChecksums.slice(0, 500)));
  }

  if (knownUrls.length > 0) {
    args.push("--known-urls", JSON.stringify(knownUrls.slice(0, 500)));
  }

  try {
    const summary = await runPythonCrawlerProcess(args);

    let finalStatus: CrawlStatus = CrawlStatus.COMPLETED;
    const rawStatus = (summary.status || "").toUpperCase();

    if (rawStatus === "AUTH_REQUIRED") finalStatus = CrawlStatus.AUTH_REQUIRED;
    else if (rawStatus === "CAPTCHA_REQUIRED") finalStatus = CrawlStatus.CAPTCHA_REQUIRED;
    else if (rawStatus === "ACCESS_BLOCKED") finalStatus = CrawlStatus.ACCESS_BLOCKED;
    else if (rawStatus === "PARTIAL") finalStatus = CrawlStatus.PARTIAL;
    else if (rawStatus === "FAILED") finalStatus = CrawlStatus.FAILED;

    // 4. Nếu không phải Dry Run và có file tải về, đưa vào ImportedDocument (PENDING)
    if (!isDryRun && summary.downloaded_documents && summary.downloaded_documents.length > 0) {
      for (const item of summary.downloaded_documents) {
        if (!item.file_info || !item.file_info.success) continue;

        const fi = item.file_info;

        // Tránh lỗi unique constraint checksum nếu file vô tình trùng
        const existing = await prisma.importedDocument.findUnique({
          where: { checksum: fi.checksum },
        });

        if (existing) {
          continue;
        }

        await prisma.importedDocument.create({
          data: {
            uploadedById: options.userId,
            originalName: fi.filename,
            storagePath: fi.storage_path,
            mimeType: fi.mime_type,
            fileFormat: fi.file_format,
            sizeBytes: fi.size_bytes,
            checksum: fi.checksum,
            status: "PENDING",
            sourceType: SourceType.CRAWLER,
            sourceUrl: item.source_url,
            detailUrl: item.detail_url,
            crawlJobId: job.id,
            editedMetadata: {
              title: item.title,
              document_number: item.document_number,
              published_date: item.published_date,
            },
          },
        });
      }
    }

    // 5. Cập nhật kết quả vào CrawlJob
    const updatedJob = await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        pagesScanned: summary.pages_scanned || 0,
        itemsFound: summary.items_found || 0,
        newItems: summary.new_items || 0,
        duplicateItems: summary.duplicate_items || 0,
        failedItems: summary.failed_items || 0,
        downloadedFiles: summary.downloaded_files || 0,
        skippedFiles: summary.skipped_files || 0,
        errorMessage: summary.error_message || null,
        summaryJson: summary as any,
        finishedAt: new Date(),
      },
      include: {
        importedDocuments: {
          select: { id: true, originalName: true, status: true, sizeBytes: true },
        },
      },
    });

    return updatedJob;
  } catch (error: any) {
    console.error("[executeCrawlJob] Lỗi thực thi:", error);
    const failedJob = await prisma.crawlJob.update({
      where: { id: job.id },
      data: {
        status: CrawlStatus.FAILED,
        errorMessage: error.message || "Lỗi không xác định khi thực thi crawler.",
        finishedAt: new Date(),
      },
    });
    return failedJob;
  }
}

/**
 * Gọi tiến trình Python và parse JSON kết quả
 */
function runPythonCrawlerProcess(args: string[]): Promise<CrawlJobSummary> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", args, {
      cwd: path.resolve(process.cwd(), ".."),
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let stdoutData = "";
    let stderrData = "";

    py.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString("utf-8");
    });

    py.stderr.on("data", (chunk) => {
      stderrData += chunk.toString("utf-8");
    });

    py.on("close", (code) => {
      if (code !== 0 && !stdoutData.trim()) {
        return reject(
          new Error(
            `Tiến trình Python Crawler thoát với mã lỗi ${code}: ${stderrData || "Không có thông tin lỗi"}`
          )
        );
      }

      try {
        const parsed: CrawlJobSummary = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err: any) {
        // Nếu không parse được JSON, tìm đoạn JSON hợp lệ trong output
        const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return resolve(parsed);
          } catch {}
        }
        reject(
          new Error(
            `Không thể parse kết quả JSON từ Crawler: ${err.message}. Raw output: ${stdoutData.slice(0, 300)}`
          )
        );
      }
    });

    py.on("error", (err) => {
      reject(new Error(`Không thể khởi chạy lệnh python: ${err.message}`));
    });
  });
}

/**
 * Lấy lịch sử các lượt quét thông báo gần nhất
 */
export async function getCrawlJobs(limit = 20) {
  return prisma.crawlJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: { importedDocuments: true },
      },
    },
  });
}

/**
 * Lấy thông tin chi tiết một lượt quét cụ thể
 */
export async function getCrawlJobById(id: string) {
  return prisma.crawlJob.findUnique({
    where: { id },
    include: {
      importedDocuments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

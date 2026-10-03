// web/app/api/admin/import/bulk-process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Thực thi script Python bóc tách tài liệu (PDF, DOCX, HTML, Scan OCR)
 */
function runPythonExtractor(filePath: string, format: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(process.cwd(), "../crawler/extract_for_import.py");
    const py = spawn("python", [pythonScript, "--file", filePath, "--format", format]);

    let stdoutData = "";
    let stderrData = "";

    const timer = setTimeout(() => {
      py.kill();
      reject(new Error("Quá trình bóc tách tài liệu bị quá thời gian cho phép (timeout 180s)."));
    }, 180000);

    py.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString("utf-8");
    });

    py.stderr.on("data", (chunk) => {
      stderrData += chunk.toString("utf-8");
    });

    py.on("close", (code) => {
      clearTimeout(timer);
      try {
        if (!stdoutData.trim()) {
          return reject(
            new Error(`Python extractor không trả về dữ liệu (exit code ${code}). Stderr: ${stderrData}`)
          );
        }
        const parsed = JSON.parse(stdoutData);
        resolve(parsed);
      } catch (err: any) {
        reject(
          new Error(
            `Lỗi parse kết quả JSON từ Python (exit code ${code}): ${err.message}. Raw output: ${stdoutData.slice(
              0,
              300
            )}`
          )
        );
      }
    });

    py.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Không thể khởi động tiến trình Python: ${err.message}`));
    });
  });
}

/**
 * Xử lý 1 tài liệu đơn lẻ với cơ chế cách ly lỗi an toàn tuyệt đối
 */
async function processSingleDocument(doc: {
  id: string;
  storagePath: string;
  fileFormat: string;
  originalName: string;
  editedMetadata?: any;
}) {
  const storage = getStorageAdapter();
  const absPath = storage.getAbsolutePath(doc.storagePath);

  // 1. Đánh dấu PROCESSING
  await prisma.importedDocument.update({
    where: { id: doc.id },
    data: {
      status: "PROCESSING",
      processingStartedAt: new Date(),
      workerPid: process.pid,
      errorMessage: null,
    },
  });

  try {
    const result = await runPythonExtractor(absPath, doc.fileFormat);

    if (result.success) {
      const hints = result.metadata_hints || {};
      const validity = result.validity_analysis || {};
      const existingEdited = (doc.editedMetadata as any) || {};

      // Điền sẵn metadata gợi ý nếu Admin chưa từng chỉnh sửa thủ công
      const initialEditedMetadata = {
        title: existingEdited.title || hints.title_candidate || doc.originalName,
        document_number:
          existingEdited.document_number !== undefined
            ? existingEdited.document_number
            : hints.document_number || "",
        issue_date:
          existingEdited.issue_date !== undefined
            ? existingEdited.issue_date
            : hints.issue_date || validity.issue_date || "",
        issuing_unit:
          existingEdited.issuing_unit !== undefined
            ? existingEdited.issuing_unit
            : hints.issuing_unit || "Trường Đại học Kiến trúc Đà Nẵng",
        category:
          existingEdited.category !== undefined
            ? existingEdited.category
            : hints.category_hint || "Thông báo",
        effective_status:
          existingEdited.effective_status !== undefined
            ? existingEdited.effective_status
            : validity.suggested_status || "unverified",
        status_evidence:
          existingEdited.status_evidence !== undefined
            ? existingEdited.status_evidence
            : validity.status_evidence || "",
        deadline:
          existingEdited.deadline !== undefined
            ? existingEdited.deadline
            : validity.deadline || "",
        effective_from:
          existingEdited.effective_from !== undefined
            ? existingEdited.effective_from
            : validity.effective_from || "",
        effective_to:
          existingEdited.effective_to !== undefined
            ? existingEdited.effective_to
            : validity.effective_to || "",
        replaced_by:
          existingEdited.replaced_by !== undefined
            ? existingEdited.replaced_by
            : validity.replaced_by || "",
      };

      const updated = await prisma.importedDocument.update({
        where: { id: doc.id },
        data: {
          status: "PROCESSED",
          extractedJson: result,
          editedMetadata: initialEditedMetadata,
          processedAt: new Date(),
          workerPid: null,
          errorMessage: null,
        },
      });

      return {
        id: doc.id,
        success: true,
        status: "PROCESSED",
        title: initialEditedMetadata.title,
        validity: validity.suggested_status,
        qualityScore: result.quality_report?.score || 100,
        pages: result.total_pages || 0,
      };
    } else {
      const errMsg = result.error || "Lỗi bóc tách tài liệu từ module Python.";
      await prisma.importedDocument.update({
        where: { id: doc.id },
        data: {
          status: "FAILED",
          errorMessage: errMsg,
          retryCount: { increment: 1 },
          workerPid: null,
        },
      });

      return {
        id: doc.id,
        success: false,
        status: "FAILED",
        error: errMsg,
      };
    }
  } catch (err: any) {
    const errMsg = err.message || "Lỗi ngoại lệ trong quá trình xử lý.";
    await prisma.importedDocument.update({
      where: { id: doc.id },
      data: {
        status: "FAILED",
        errorMessage: errMsg,
        retryCount: { increment: 1 },
        workerPid: null,
      },
    });

    return {
      id: doc.id,
      success: false,
      status: "FAILED",
      error: errMsg,
    };
  }
}

/**
 * Helper thực thi concurrency pool có giới hạn
 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => taskFn(item));
    results.push(p as any);

    if (concurrency <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Yêu cầu quyền quản trị viên." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = (body.mode || "ALL_PENDING").toUpperCase(); // "ALL_PENDING" | "SELECTED" | "RETRY_FAILED"
    const requestedIds: string[] = Array.isArray(body.ids) ? body.ids : [];
    
    // Batch size & Concurrency configurable
    const batchSize = Math.max(1, Math.min(100, parseInt(body.batchSize || "20", 10)));
    const envConcurrency = parseInt(process.env.IMPORT_MAX_CONCURRENCY || "2", 10);
    const maxConcurrency = Math.max(1, Math.min(4, envConcurrency));

    // 1. Phục hồi các job bị treo (Stale Recovery: PROCESSING > 5 phút)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.importedDocument.updateMany({
      where: {
        status: "PROCESSING",
        processingStartedAt: { lt: fiveMinutesAgo },
      },
      data: {
        status: "PENDING",
        errorMessage: "Tự động khôi phục từ trạng thái treo (Timeout/Server restart recovery).",
        workerPid: null,
      },
    });

    // 2. Lấy danh sách tài liệu cần xử lý theo chế độ
    let targetWhere: any = {};
    if (mode === "SELECTED" && requestedIds.length > 0) {
      targetWhere = {
        id: { in: requestedIds },
        status: { in: ["PENDING", "FAILED"] },
      };
    } else if (mode === "RETRY_FAILED") {
      targetWhere = {
        status: "FAILED",
      };
    } else {
      // Mặc định: ALL_PENDING
      targetWhere = {
        status: "PENDING",
      };
    }

    // Đếm tổng số lượng thỏa mãn điều kiện
    const totalMatching = await prisma.importedDocument.count({ where: targetWhere });

    // Lấy batch tài liệu cần xử lý
    const docsToProcess = await prisma.importedDocument.findMany({
      where: targetWhere,
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: {
        id: true,
        storagePath: true,
        fileFormat: true,
        originalName: true,
        editedMetadata: true,
      },
    });

    if (docsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Không có tài liệu nào cần xử lý trong hàng đợi.",
        processedCount: 0,
        failedCount: 0,
        totalInBatch: 0,
        remainingPending: 0,
        results: [],
      });
    }

    // 3. Thực thi xử lý song song có kiểm soát Concurrency (mặc định 2)
    const batchResults = await runWithConcurrency(
      docsToProcess,
      maxConcurrency,
      async (doc) => {
        return processSingleDocument(doc);
      }
    );

    const successCount = batchResults.filter((r) => r.success).length;
    const failCount = batchResults.filter((r) => !r.success).length;

    // Đếm lại số tài liệu PENDING còn lại sau batch này
    const remainingPending = await prisma.importedDocument.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      success: true,
      message: `Đã xử lý xong batch ${docsToProcess.length} tài liệu: ${successCount} thành công, ${failCount} thất bại.`,
      batchSize,
      concurrency: maxConcurrency,
      processedCount: successCount,
      failedCount: failCount,
      totalInBatch: docsToProcess.length,
      remainingPending,
      hasMore: remainingPending > 0,
      results: batchResults,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/import/bulk-process Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xử lý hàng loạt tài liệu: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [pending, processing, processed, failed, published] = await Promise.all([
      prisma.importedDocument.count({ where: { status: "PENDING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSED" } }),
      prisma.importedDocument.count({ where: { status: "FAILED" } }),
      prisma.importedDocument.count({ where: { status: "PUBLISHED" } }),
    ]);

    return NextResponse.json({
      success: true,
      queueHealth: {
        pending,
        processing,
        processed,
        failed,
        published,
        total: pending + processing + processed + failed + published,
        maxConcurrency: parseInt(process.env.IMPORT_MAX_CONCURRENCY || "2", 10),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

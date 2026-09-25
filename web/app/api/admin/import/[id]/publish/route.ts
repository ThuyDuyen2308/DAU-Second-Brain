// web/app/api/admin/import/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { Document, DocumentPage } from "@/types/document";
import { chunkPageText } from "@/lib/ai/chunking";
import { getAvailableEmbeddingProvider } from "@/lib/ai/embedding_provider";
import { loadEmbeddingIndex, saveEmbeddingIndex } from "@/lib/ai/embedding_cache";
import { EmbeddedChunkItem, EmbeddingIndex } from "@/types/ask";

export const dynamic = "force-dynamic";

const DATASET_PATH = path.resolve(process.cwd(), "../crawler/data/normalized/documents.json");
const LOCK_FILE_PATH = path.resolve(process.cwd(), "../crawler/data/normalized/documents.json.lock");

/**
 * Acquire file lock an toàn
 */
async function acquireLock(maxRetries = 10, delayMs = 300): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Dùng flag "wx" để tạo file độc quyền (fail nếu file đã tồn tại)
      const fd = fs.openSync(LOCK_FILE_PATH, "wx");
      fs.writeSync(fd, `${process.pid}\n${new Date().toISOString()}`);
      fs.closeSync(fd);
      return true;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Kiểm tra stale lock (> 30s)
        try {
          const stats = fs.statSync(LOCK_FILE_PATH);
          if (Date.now() - stats.mtimeMs > 30000) {
            fs.unlinkSync(LOCK_FILE_PATH);
            continue;
          }
        } catch {
          // File lock vừa được xóa bởi process khác
        }
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
  return false;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  } catch (err) {
    console.warn("[releaseLock] Cảnh báo giải phóng lock:", err);
  }
}

/**
 * Ghi file an toàn tuyệt đối: Atomic Write + Backup
 */
function safeWriteDocumentsJson(documents: Document[]): void {
  const dir = path.dirname(DATASET_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Backup file cũ nếu tồn tại
  if (fs.existsSync(DATASET_PATH)) {
    const backupPath = path.resolve(dir, "documents.json.bak");
    try {
      fs.copyFileSync(DATASET_PATH, backupPath);
    } catch (bkErr) {
      console.warn("[safeWriteDocumentsJson] Không thể tạo backup file:", bkErr);
    }
  }

  // Ghi ra file tạm với PID
  const tempPath = path.resolve(dir, `documents.json.tmp.${process.pid}.${Date.now()}`);
  const jsonContent = JSON.stringify(documents, null, 2);
  fs.writeFileSync(tempPath, jsonContent, "utf-8");

  // Atomic rename đè lên file chính
  fs.renameSync(tempPath, DATASET_PATH);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let lockAcquired = false;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Chỉ quản trị viên mới có quyền duyệt và công bố tài liệu." }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.importedDocument.findUnique({ where: { id } });

    if (!document) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu import." }, { status: 404 });
    }

    if (document.status === "PUBLISHED") {
      return NextResponse.json({ error: "Tài liệu này đã được công bố trước đó." }, { status: 400 });
    }

    if (document.status !== "PROCESSED" || !document.extractedJson) {
      return NextResponse.json(
        { error: "Tài liệu chưa được bóc tách nội dung thành công. Vui lòng kiểm tra lại tiến trình bóc tách." },
        { status: 400 }
      );
    }

    const extJson = document.extractedJson as any;
    const pages = (extJson.pages || []) as DocumentPage[];

    if (!pages.length) {
      return NextResponse.json({ error: "Tài liệu không có nội dung trang văn bản nào để công bố." }, { status: 400 });
    }

    // Tổng hợp nội dung đầy đủ
    const fullContent = pages.map((p) => p.cleaned_text || p.raw_text || "").join("\n\n").trim();
    if (!fullContent) {
      return NextResponse.json({ error: "Toàn bộ nội dung văn bản sau bóc tách là rỗng." }, { status: 400 });
    }

    // Tổng hợp metadata: Ưu tiên editedMetadata > metadata_hints > default
    const edited = (document.editedMetadata as any) || {};
    const hints = extJson.metadata_hints || {};

    const title = edited.title || hints.title_candidate || document.originalName;
    const docNumber = edited.document_number !== undefined ? edited.document_number : (hints.document_number || null);
    const issueDate = edited.issue_date !== undefined ? edited.issue_date : (hints.issue_date || null);
    const issuingUnit = edited.issuing_unit !== undefined ? edited.issuing_unit : (hints.issuing_unit || null);
    const category = edited.category !== undefined ? edited.category : (hints.category_hint || "Thông báo");
    const subcategory = edited.subcategory || null;
    const deadline = edited.deadline || null;
    
    // Quy tắc bất biến: Không tự ý đánh dấu "effective" nếu không có căn cứ rõ ràng
    const effectiveStatus = edited.effective_status || "unknown";

    // Sinh Document ID ổn định theo checksum
    const docId = `dau_doc_${document.checksum.slice(0, 12)}`;

    const newDocument: Document = {
      id: docId,
      title: title.trim(),
      document_number: docNumber ? String(docNumber).trim() : null,
      issue_date: issueDate ? String(issueDate).trim() : null,
      issuing_unit: issuingUnit ? String(issuingUnit).trim() : null,
      category: category ? String(category).trim() : null,
      subcategory: subcategory ? String(subcategory).trim() : null,
      deadline: deadline ? String(deadline).trim() : null,
      effective_status: effectiveStatus,
      effective_from: edited.effective_from || null,
      effective_to: edited.effective_to || null,
      replaced_by: edited.replaced_by || null,
      source_url: "",
      detail_url: "",
      source_file: document.originalName,
      file_format: document.fileFormat,
      total_pages: pages.length,
      content: fullContent,
      pages,
      attachments: [],
      metadata: {
        crawled_at: new Date().toISOString(),
        crawl_status: "admin_imported",
        content_source: "admin_upload",
        raw_issue_date: issueDate || undefined,
      },
      provenance: {
        notification_title: title.trim(),
        document_file: document.originalName,
      },
    };

    // 1. Khóa file documents.json chống race condition
    lockAcquired = await acquireLock(15, 300);
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Hệ thống đang bận cập nhật dữ liệu từ tiến trình khác. Vui lòng thử lại sau giây lát." },
        { status: 503 }
      );
    }

    // 2. Đọc và cập nhật documents.json
    let existingDocuments: Document[] = [];
    if (fs.existsSync(DATASET_PATH)) {
      try {
        const rawContent = fs.readFileSync(DATASET_PATH, "utf-8");
        existingDocuments = JSON.parse(rawContent);
        if (!Array.isArray(existingDocuments)) {
          existingDocuments = [];
        }
      } catch (readErr: any) {
        throw new Error(`Không thể đọc file documents.json hiện tại: ${readErr.message}`);
      }
    }

    // Kiểm tra trùng ID trong documents.json
    const existingIndex = existingDocuments.findIndex((d) => d.id === docId);
    if (existingIndex >= 0) {
      existingDocuments[existingIndex] = newDocument;
    } else {
      existingDocuments.unshift(newDocument);
    }

    // 3. Ghi file an toàn
    safeWriteDocumentsJson(existingDocuments);

    // 4. Giải phóng file lock
    releaseLock();
    lockAcquired = false;

    // 5. Cập nhật trạng thái trong database
    const updatedRecord = await prisma.importedDocument.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        documentId: docId,
        publishedAt: new Date(),
      },
    });

    // 6. Thử tạo incremental embedding nếu provider khả dụng
    let embeddingStatus = "SKIPPED";
    let embeddingMessage = "Chưa cấu hình API Key (Gemini/OpenAI). Retrieval dựa trên từ khóa (Keyword Retrieval) đã sẵn sàng phục vụ ngay lập tức.";

    try {
      const provider = getAvailableEmbeddingProvider();
      if (provider && provider.isAvailable()) {
        const chunks = [];
        for (const p of pages) {
          const text = (p.cleaned_text || p.raw_text || "").trim();
          if (text) {
            chunks.push(...chunkPageText(newDocument, p.page_number, text));
          }
        }

        if (chunks.length > 0) {
          const newEmbeddedChunks: EmbeddedChunkItem[] = [];
          for (const ch of chunks) {
            const contentToEmbed = `Tài liệu: ${ch.title}. ${ch.category ? `Chủ đề: ${ch.category}. ` : ""}Trang: ${ch.pageNumber}.\nNội dung: ${ch.text}`;
            const vec = await provider.embedText(contentToEmbed);
            newEmbeddedChunks.push({
              ...ch,
              embedding: vec,
            });
          }

          // Cập nhật vào index.json hiện có
          const currentIndex = loadEmbeddingIndex();
          let allChunks = currentIndex?.chunks || [];
          // Loại bỏ chunks cũ nếu đã có documentId này
          allChunks = allChunks.filter((c) => c.documentId !== docId);
          allChunks.push(...newEmbeddedChunks);

          const updatedIndex: EmbeddingIndex = {
            model: provider.name,
            createdAt: new Date().toISOString(),
            totalChunks: allChunks.length,
            chunks: allChunks,
          };
          saveEmbeddingIndex(updatedIndex);

          embeddingStatus = "SUCCESS";
          embeddingMessage = `Đã tạo embedding thành công cho ${newEmbeddedChunks.length} chunks bằng mô hình ${provider.name}.`;
        }
      }
    } catch (embedErr: any) {
      console.warn("[Incremental Embedding Warning]", embedErr);
      embeddingStatus = "WARNING";
      embeddingMessage = `Không thể tạo vector embedding tự động: ${embedErr.message}. Hệ thống vẫn tìm kiếm tốt bằng từ khóa.`;
    }

    return NextResponse.json({
      success: true,
      message: "Đã duyệt và công bố tài liệu thành công vào kho tri thức RAG của hệ thống.",
      documentId: docId,
      document: updatedRecord,
      embedding: {
        status: embeddingStatus,
        message: embeddingMessage,
      },
    });
  } catch (error: any) {
    if (lockAcquired) {
      releaseLock();
    }
    console.error("[POST /api/admin/import/[id]/publish Error]", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi công bố tài liệu: " + error.message }, { status: 500 });
  }
}
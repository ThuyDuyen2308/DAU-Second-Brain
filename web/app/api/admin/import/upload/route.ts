// web/app/api/admin/import/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_FILES_PER_BATCH = 100;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB per file
const MAX_BATCH_SIZE = 500 * 1024 * 1024; // 500 MB total per batch

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".html", ".htm"]);

export async function POST(req: NextRequest) {
  try {
    // 1. Phân quyền và xác thực Admin
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: Vui lòng đăng nhập." }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Chỉ quản trị viên mới có quyền upload tài liệu." }, { status: 403 });
    }

    // Resolve userId thực tế trong DB
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email.toLowerCase().trim() },
    });
    if (!dbUser) {
      dbUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    }
    if (!dbUser) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản quản trị viên trong database." }, { status: 500 });
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Vui lòng chọn ít nhất 1 file để upload." }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        { error: `Số lượng file vượt quá giới hạn cho phép (tối đa ${MAX_FILES_PER_BATCH} file mỗi lượt upload).` },
        { status: 400 }
      );
    }

    // Kiểm tra tổng dung lượng batch
    let totalBatchSize = 0;
    for (const f of files) {
      totalBatchSize += f.size;
    }
    if (totalBatchSize > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Tổng dung lượng đợt upload vượt quá 500MB (hiện tại: ${(totalBatchSize / (1024 * 1024)).toFixed(1)}MB).` },
        { status: 400 }
      );
    }

    const storage = getStorageAdapter();
    const results = [];
    let uploadedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const fileName = file.name || "unnamed";
      const ext = path.extname(fileName).toLowerCase();

      // Kiểm tra file rỗng
      if (file.size === 0) {
        results.push({
          name: fileName,
          status: "FAILED",
          error: "File rỗng (0 bytes). Vui lòng kiểm tra lại file nguồn.",
        });
        failedCount++;
        continue;
      }

      // Kiểm tra dung lượng từng file
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          name: fileName,
          status: "FAILED",
          error: `Dung lượng file vượt quá 20MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
        });
        failedCount++;
        continue;
      }

      // Xử lý cảnh báo file .doc cũ
      if (ext === ".doc") {
        results.push({
          name: fileName,
          status: "FAILED",
          error: "Định dạng file .doc cũ (binary Word 97-2003) chưa được hỗ trợ. Vui lòng mở bằng Microsoft Word/LibreOffice và lưu lại dạng .docx rồi upload lại.",
        });
        failedCount++;
        continue;
      }

      // Kiểm tra extension hợp lệ
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        results.push({
          name: fileName,
          status: "FAILED",
          error: `Định dạng ${ext || "không xác định"} không được hỗ trợ. Chỉ chấp nhận .pdf, .docx, .html.`,
        });
        failedCount++;
        continue;
      }

      // Đọc buffer & tính checksum SHA-256
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

      // Định dạng lưu trữ chuẩn
      let fileFormat = "pdf";
      if (ext === ".docx") fileFormat = "docx";
      else if (ext === ".html" || ext === ".htm") fileFormat = "html";

      // 3. Kiểm tra file trùng bằng checksum SHA-256 trong DB
      const existing = await prisma.importedDocument.findUnique({
        where: { checksum },
      });

      if (existing) {
        // File đã tồn tại trước đó
        results.push({
          id: existing.id,
          name: fileName,
          status: "DUPLICATE",
          duplicateOfId: existing.id,
          checksum,
          existingStatus: existing.status,
          message: `File này đã tồn tại trong hệ thống (ID: ${existing.id}, Trạng thái: ${existing.status}).`,
        });
        duplicateCount++;
        continue;
      }

      // 4. Lưu file an toàn qua StorageAdapter
      try {
        const storagePath = await storage.save(fileName, buffer, checksum);

        // 5. Tạo bản ghi ImportedDocument trong PostgreSQL với status PENDING
        const record = await prisma.importedDocument.create({
          data: {
            uploadedById: dbUser.id,
            originalName: fileName,
            storagePath,
            mimeType: file.type || "application/octet-stream",
            fileFormat,
            sizeBytes: file.size,
            checksum,
            status: "PENDING",
          },
        });

        results.push({
          id: record.id,
          name: fileName,
          status: "PENDING",
          sizeBytes: file.size,
          checksum,
          message: "Upload thành công, đã xếp vào hàng đợi xử lý nền.",
        });
        uploadedCount++;
      } catch (err: any) {
        console.error(`[Upload Error] Lỗi lưu file ${fileName}:`, err);
        results.push({
          name: fileName,
          status: "FAILED",
          error: `Lỗi hệ thống khi lưu trữ file: ${err.message || String(err)}`,
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: files.length,
      uploaded: uploadedCount,
      duplicates: duplicateCount,
      failed: failedCount,
      items: results,
    });
  } catch (error: any) {
    console.error("[Upload API Error]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ trong quá trình upload: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
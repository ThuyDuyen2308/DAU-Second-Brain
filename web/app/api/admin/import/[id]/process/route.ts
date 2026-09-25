// web/app/api/admin/import/[id]/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Thực thi script Python bóc tách tài liệu
 */
function runPythonExtractor(filePath: string, format: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(process.cwd(), "../crawler/extract_for_import.py");
    const py = spawn("python", [pythonScript, "--file", filePath, "--format", format]);

    let stdoutData = "";
    let stderrData = "";

    const timer = setTimeout(() => {
      py.kill();
      reject(new Error("Quá trình bóc tách tài liệu bị quá thời gian cho phép (timeout 120s)."));
    }, 120000);

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
          return reject(new Error(`Python extractor không trả về dữ liệu (exit code ${code}). Stderr: ${stderrData}`));
        }
        const parsed = JSON.parse(stdoutData);
        resolve(parsed);
      } catch (err: any) {
        reject(new Error(`Lỗi parse kết quả JSON từ Python (exit code ${code}): ${err.message}. Raw output: ${stdoutData.slice(0, 300)}`));
      }
    });

    py.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Không thể khởi động tiến trình Python: ${err.message}`));
    });
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.importedDocument.findUnique({ where: { id } });

    if (!document) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }

    if (document.status === "PUBLISHED") {
      return NextResponse.json({ error: "Tài liệu đã được công bố, không thể xử lý lại." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const syncMode = searchParams.get("sync") === "true";

    if (!syncMode) {
      // Chế độ bất đồng bộ (mặc định): chuyển về PENDING để background worker xử lý
      const updated = await prisma.importedDocument.update({
        where: { id },
        data: {
          status: "PENDING",
          errorMessage: null,
          retryCount: { increment: 1 },
        },
      });
      return NextResponse.json({
        success: true,
        message: "Đã đưa tài liệu vào hàng đợi xử lý nền.",
        document: updated,
      });
    }

    // Chế độ xử lý ngay (sync mode)
    const storage = getStorageAdapter();
    const absPath = storage.getAbsolutePath(document.storagePath);

    await prisma.importedDocument.update({
      where: { id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
        errorMessage: null,
      },
    });

    try {
      const result = await runPythonExtractor(absPath, document.fileFormat);

      if (result.success) {
        const updated = await prisma.importedDocument.update({
          where: { id },
          data: {
            status: "PROCESSED",
            extractedJson: result,
            processedAt: new Date(),
            errorMessage: null,
          },
        });
        return NextResponse.json({
          success: true,
          message: "Bóc tách tài liệu thành công.",
          document: updated,
        });
      } else {
        const updated = await prisma.importedDocument.update({
          where: { id },
          data: {
            status: "FAILED",
            errorMessage: result.error || "Lỗi không xác định trong quá trình bóc tách.",
            retryCount: { increment: 1 },
          },
        });
        return NextResponse.json({
          success: false,
          message: "Bóc tách thất bại: " + result.error,
          document: updated,
        });
      }
    } catch (procErr: any) {
      const updated = await prisma.importedDocument.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: procErr.message,
          retryCount: { increment: 1 },
        },
      });
      return NextResponse.json({
        success: false,
        message: "Lỗi thực thi: " + procErr.message,
        document: updated,
      });
    }
  } catch (error: any) {
    console.error("[POST /api/admin/import/[id]/process Error]", error);
    return NextResponse.json({ error: "Lỗi máy chủ: " + error.message }, { status: 500 });
  }
}
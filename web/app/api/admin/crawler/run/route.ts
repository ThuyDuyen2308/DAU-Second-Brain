// web/app/api/admin/crawler/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { executeCrawlJob } from "@/lib/crawler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Phân quyền và xác thực Admin
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập tài khoản quản trị." },
        { status: 401 }
      );
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Chỉ quản trị viên mới có quyền thực thi crawler." },
        { status: 403 }
      );
    }

    // Resolve userId thực tế trong DB
    let dbUser = await prisma.user.findUnique({
      where: { email: currentUser.email.toLowerCase().trim() },
    });
    if (!dbUser) {
      dbUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    }
    if (!dbUser) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản quản trị viên trong database." },
        { status: 500 }
      );
    }

    // 2. Parse request body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const maxPages = Math.min(Math.max(parseInt(body.maxPages || "3", 10) || 1, 1), 20);
    const dryRun = !!body.dryRun;
    const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : undefined;

    // 3. Thực thi crawler
    const job = await executeCrawlJob({
      maxPages,
      dryRun,
      sourceUrl,
      userId: dbUser.id,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      summary: {
        pagesScanned: job.pagesScanned,
        itemsFound: job.itemsFound,
        newItems: job.newItems,
        duplicateItems: job.duplicateItems,
        failedItems: job.failedItems,
        downloadedFiles: job.downloadedFiles,
        isDryRun: job.isDryRun,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
      job,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/crawler/run] Lỗi:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi thực thi crawler. Vui lòng kiểm tra lại cấu hình." },
      { status: 500 }
    );
  }
}

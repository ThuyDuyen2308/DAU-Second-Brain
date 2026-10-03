// web/app/api/admin/crawler/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getCrawlJobs } from "@/lib/crawler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập tài khoản quản trị." },
        { status: 401 }
      );
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Chỉ quản trị viên mới có quyền xem lịch sử crawler." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 1, 1), 100);

    const jobs = await getCrawlJobs(limit);

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error: any) {
    console.error("[GET /api/admin/crawler/jobs] Lỗi:", error);
    return NextResponse.json(
      { error: "Không thể lấy lịch sử crawler." },
      { status: 500 }
    );
  }
}

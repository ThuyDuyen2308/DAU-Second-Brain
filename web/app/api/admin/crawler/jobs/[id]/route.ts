// web/app/api/admin/crawler/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getCrawlJobById } from "@/lib/crawler";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
        { error: "Forbidden: Chỉ quản trị viên mới có quyền xem chi tiết crawler." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const job = await getCrawlJobById(id);

    if (!job) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin lượt quét." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("[GET /api/admin/crawler/jobs/[id]] Lỗi:", error);
    return NextResponse.json(
      { error: "Không thể lấy chi tiết lượt quét." },
      { status: 500 }
    );
  }
}

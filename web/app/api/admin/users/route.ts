// web/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Bạn không có quyền xem danh sách người dùng." },
        { status: 403 }
      );
    }

    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedUsers = dbUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "ADMIN" ? ("Admin" as const) : ("Sinh viên" as const),
      status: u.isActive !== false ? ("Hoạt động" as const) : ("Tạm khóa" as const),
      createdAt: u.createdAt.toISOString().split("T")[0],
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/admin/users Error]", msg);
    return NextResponse.json(
      { error: `Lỗi máy chủ khi truy vấn danh sách người dùng: ${msg}` },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const currentUser = await getCurrentUser(req);

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Chỉ quản trị viên mới có quyền cập nhật trạng thái tài khoản." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Dữ liệu yêu cầu không hợp lệ." },
        { status: 400 }
      );
    }

    const { userId, isActive } = body;

    if (!userId || typeof userId !== "string" || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Thiếu userId hoặc trạng thái isActive không hợp lệ." },
        { status: 400 }
      );
    }

    if (currentUser.id === userId && !isActive) {
      return NextResponse.json(
        { error: "Bạn không thể tự khóa tài khoản quản trị của chính mình." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Không tìm thấy người dùng." }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã ${isActive ? "mở khóa" : "tạm khóa"} tài khoản ${updatedUser.email} thành công.`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role === "ADMIN" ? "Admin" : "Sinh viên",
        status: updatedUser.isActive ? "Hoạt động" : "Tạm khóa",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PATCH /api/admin/users Error]", msg);
    return NextResponse.json({ error: `Lỗi máy chủ: ${msg}` }, { status: 500 });
  }
}

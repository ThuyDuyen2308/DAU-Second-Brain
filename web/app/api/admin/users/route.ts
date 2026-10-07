// web/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    // 1. Kiểm tra xác thực
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    // 2. Kiểm tra phân quyền: Chỉ role admin được phép truy cập
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Bạn không có quyền xem danh sách người dùng hệ thống." },
        { status: 403 }
      );
    }

    // 3. Truy vấn danh sách người dùng từ PostgreSQL (loại bỏ tuyệt đối passwordHash)
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
  } catch (error) {
    console.error("[GET /api/admin/users Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi truy vấn danh sách người dùng." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    // 1. Kiểm tra xác thực
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    // 2. Kiểm tra phân quyền Admin
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

    // 3. Không cho phép admin tự khóa chính mình
    if (currentUser.id === userId && !isActive) {
      return NextResponse.json(
        { error: "Bạn không thể tự khóa tài khoản quản trị của chính mình." },
        { status: 400 }
      );
    }

    // 4. Cập nhật vào PostgreSQL
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng trong cơ sở dữ liệu." },
        { status: 404 }
      );
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
        ...updatedUser,
        role: updatedUser.role === "ADMIN" ? "Admin" : "Sinh viên",
        status: updatedUser.isActive ? "Hoạt động" : "Tạm khóa",
      },
    });
  } catch (error) {
    console.error("[PATCH /api/admin/users Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi cập nhật trạng thái người dùng." },
      { status: 500 }
    );
  }
}
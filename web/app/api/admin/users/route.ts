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
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedUsers = dbUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "ADMIN" ? "Admin" : "Sinh viên",
      status: "Hoạt động" as const,
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
// web/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { createSessionToken } from "@/lib/auth/session";
import { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Dữ liệu yêu cầu không hợp lệ." },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đầy đủ email và mật khẩu." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let authenticatedUser: AuthUser | null = null;

    // 1. Kiểm tra tài khoản trong Database thực tế (PostgreSQL)
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (dbUser && dbUser.passwordHash) {
        const isPasswordCorrect = await verifyPassword(cleanPassword, dbUser.passwordHash);
        if (isPasswordCorrect) {
          authenticatedUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role === "ADMIN" ? "admin" : "student",
          };
        }
      }
    } catch (dbError) {
      console.warn("[Login API] Không thể truy vấn database hoặc đang kết nối lại:", dbError);
    }

    // 2. Fallback kiểm tra cấu hình demo tĩnh nếu chưa có trong database
    if (!authenticatedUser) {
      if (
        cleanEmail === AUTH_CONFIG.admin.email &&
        cleanPassword === AUTH_CONFIG.admin.password
      ) {
        authenticatedUser = {
          id: "dau_admin_01",
          email: AUTH_CONFIG.admin.email,
          name: AUTH_CONFIG.admin.name,
          role: "admin",
        };
      } else if (
        cleanEmail === AUTH_CONFIG.student.email &&
        cleanPassword === AUTH_CONFIG.student.password
      ) {
        authenticatedUser = {
          id: "dau_student_01",
          email: AUTH_CONFIG.student.email,
          name: AUTH_CONFIG.student.name,
          role: "student",
        };
      }
    }

    // Nếu thông tin đăng nhập không khớp bất kỳ tài khoản nào
    if (!authenticatedUser) {
      // Thông báo chung để phòng ngừa user enumeration
      return NextResponse.json(
        { success: false, message: "Email hoặc mật khẩu không chính xác." },
        { status: 401 }
      );
    }

    // Tạo Session Token có chữ ký HMAC an toàn server-side
    const token = await createSessionToken(authenticatedUser);

    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng nhập thành công.",
        user: authenticatedUser,
      },
      { status: 200 }
    );

    // Thiết lập HTTP-Only Cookie cho Session
    response.cookies.set({
      name: AUTH_CONFIG.cookieName,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_CONFIG.sessionMaxAge,
    });

    return response;
  } catch (error) {
    console.error("[Login API] Lỗi xử lý đăng nhập:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi máy chủ trong quá trình xác thực." },
      { status: 500 }
    );
  }
}
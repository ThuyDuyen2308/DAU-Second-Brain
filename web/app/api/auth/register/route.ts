// web/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { createSessionToken } from "@/lib/auth/session";
import { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { isValidEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Dữ liệu yêu cầu không hợp lệ." },
        { status: 400 }
      );
    }

    const { name, email, password, confirmPassword } = body;

    // 1. Kiểm tra trường họ tên
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập họ và tên của bạn." },
        { status: 400 }
      );
    }
    const cleanName = name.trim();
    if (cleanName.length > 100) {
      return NextResponse.json(
        { success: false, message: "Họ và tên không được vượt quá 100 ký tự." },
        { status: 400 }
      );
    }

    // 2. Kiểm tra email
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Định dạng email không hợp lệ. Vui lòng nhập email đúng." },
        { status: 400 }
      );
    }
    const cleanEmail = email.trim().toLowerCase();

    // 3. Kiểm tra mật khẩu
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, message: passwordValidation.message },
        { status: 400 }
      );
    }

    // 4. Kiểm tra xác nhận mật khẩu
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    // 5. Kiểm tra email đã tồn tại trong database chưa
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Email này đã được sử dụng trên hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác." },
        { status: 409 }
      );
    }

    // 6. Băm mật khẩu bằng bcrypt
    const passwordHash = await hashPassword(password);

    // 7. Lưu user vào database với role cố định là STUDENT (tuyệt đối không cho chọn ADMIN)
    const newUser = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash: passwordHash,
        role: "STUDENT",
      },
    });

    const authenticatedUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: "student",
    };

    // 8. Tạo session token có chữ ký HMAC an toàn server-side
    const token = await createSessionToken(authenticatedUser);

    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng ký tài khoản thành công!",
        user: authenticatedUser,
      },
      { status: 201 }
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
    console.error("[Register API] Lỗi xử lý đăng ký:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi máy chủ trong quá trình đăng ký tài khoản." },
      { status: 500 }
    );
  }
}
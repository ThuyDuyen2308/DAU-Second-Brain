// web/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Dữ liệu yêu cầu không hợp lệ." },
        { status: 400 }
      );
    }

    const { token, newPassword, confirmPassword } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, message: "Mã khôi phục (token) không hợp lệ." },
        { status: 400 }
      );
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, message: passwordValidation.message },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    // 1. Tính toán hash SHA-256 từ raw token nhận được
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    // 2. Tìm bản ghi token chưa sử dụng và chưa hết hạn
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { success: false, message: "Mã khôi phục không hợp lệ hoặc không tồn tại." },
        { status: 400 }
      );
    }

    if (resetRecord.usedAt !== null) {
      return NextResponse.json(
        { success: false, message: "Mã khôi phục này đã được sử dụng trước đó." },
        { status: 400 }
      );
    }

    if (new Date() > resetRecord.expiresAt) {
      return NextResponse.json(
        { success: false, message: "Mã khôi phục đã hết hạn. Vui lòng yêu cầu mã mới." },
        { status: 400 }
      );
    }

    // 3. Băm mật khẩu mới bằng bcrypt
    const passwordHash = await hashPassword(newPassword);

    // 4. Cập nhật mật khẩu người dùng và đánh dấu token đã sử dụng trong một transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (error) {
    console.error("[Reset Password API] Lỗi xử lý yêu cầu:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi máy chủ trong quá trình đặt lại mật khẩu." },
      { status: 500 }
    );
  }
}
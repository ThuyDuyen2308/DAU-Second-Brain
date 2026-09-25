// web/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
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

    const { email } = body;

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập định dạng email sinh viên hợp lệ." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Tìm người dùng trong cơ sở dữ liệu
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Nguyên tắc bảo mật: Luôn trả về phản hồi chung nhằm ngăn chặn kẻ tấn công dò tìm tài khoản (User Enumeration)
    const genericResponse = {
      success: true,
      message: "Nếu email tồn tại trên hệ thống, yêu cầu đặt lại mật khẩu đã được khởi tạo.",
    };

    if (!user) {
      return NextResponse.json(genericResponse, { status: 200 });
    }

    // 2. Tạo token ngẫu nhiên có độ dài 32 bytes (64 ký tự hex)
    const rawToken = crypto.randomBytes(32).toString("hex");

    // 3. Chỉ lưu hash SHA-256 của token vào cơ sở dữ liệu (tuyệt đối không lưu raw token)
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Thời hạn token: 1 giờ (3600000 ms)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // 4. Lưu bản ghi PasswordResetToken vào cơ sở dữ liệu
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Lưu ý: Cần cấu hình SMTP server (SendGrid / Resend / AWS SES) để gửi email chứa link đặt lại mật khẩu
    // Ví dụ link thực tế: https://dau.edu.vn/reset-password?token=${rawToken}
    console.log(`[Forgot Password] Đã tạo token reset cho user ${user.id} (hạn dùng: 1h).`);

    return NextResponse.json(genericResponse, { status: 200 });
  } catch (error) {
    console.error("[Forgot Password API] Lỗi xử lý yêu cầu:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi máy chủ trong quá trình xử lý yêu cầu." },
      { status: 500 }
    );
  }
}
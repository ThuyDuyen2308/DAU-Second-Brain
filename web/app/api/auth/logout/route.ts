// web/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";

export async function POST() {
  try {
    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng xuất thành công.",
      },
      { status: 200 }
    );

    // Xóa session cookie bằng cách đặt maxAge = 0
    response.cookies.set({
      name: AUTH_CONFIG.cookieName,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("[Logout API] Lỗi xử lý đăng xuất:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi máy chủ khi đăng xuất." },
      { status: 500 }
    );
  }
}

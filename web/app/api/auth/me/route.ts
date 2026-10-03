// web/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    // Đọc token từ Authorization Bearer header trước (tab-isolated),
    // sau đó fallback về cookie (đăng nhập bình thường)
    let token: string | undefined;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim() || undefined;
    }
    if (!token) {
      token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
    }

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const session = await verifySessionToken(token);

    if (!session || !session.user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: session.user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Me API] Lỗi kiểm tra phiên:", error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

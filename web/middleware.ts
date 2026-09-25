// web/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bảo vệ tất cả tuyến đường bắt đầu bằng /admin
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;

    // 1. Nếu chưa đăng nhập -> Chuyển hướng đến /login với tham số redirect an toàn
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 2. Xác minh chữ ký HMAC và thời hạn của session
    const session = await verifySessionToken(token);

    if (!session || !session.user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      
      // Xóa cookie hết hạn/không hợp lệ
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_CONFIG.cookieName);
      return response;
    }

    // 3. Kiểm tra phân quyền: Nếu không có role admin -> Chuyển hướng đến 403
    if (session.user.role !== "admin") {
      const forbiddenUrl = new URL("/403", req.url);
      return NextResponse.redirect(forbiddenUrl);
    }

    // 4. Quyền Admin hợp lệ -> Cho phép truy cập
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Chỉ áp dụng Middleware trên đường dẫn /admin và các tuyến con
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

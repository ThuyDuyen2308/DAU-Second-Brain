// web/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/session";

/**
 * Đọc session token từ cookie HOẶC Authorization Bearer header.
 * Ưu tiên Authorization header để hỗ trợ đa tab.
 * Nếu truy cập khu vực Admin (/admin hoặc /api/admin), kiểm tra cookie dau_admin_session trước.
 */
function extractToken(req: NextRequest, isAdminArea = false): string | undefined {
  // 1. Ưu tiên Authorization Bearer header (tab-isolated từ sessionStorage)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  // 2. Nếu là khu vực Admin (/admin hoặc /api/admin), chỉ chấp nhận cookie admin (dau_admin_session)
  if (isAdminArea) {
    return req.cookies.get(AUTH_CONFIG.adminCookieName)?.value;
  }
  // 3. Với các khu vực khác (người dùng/sinh viên), đọc cookie chung trước, fallback admin
  return req.cookies.get(AUTH_CONFIG.cookieName)?.value || req.cookies.get(AUTH_CONFIG.adminCookieName)?.value;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bảo vệ các API quản trị bắt đầu bằng /api/admin
  if (pathname.startsWith("/api/admin")) {
    const token = extractToken(req, true);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Vui lòng đăng nhập để truy cập tài nguyên quản trị." },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);
    if (!session || !session.user) {
      const response = NextResponse.json(
        { error: "Unauthorized: Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
      response.cookies.delete(AUTH_CONFIG.adminCookieName);
      return response;
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Yêu cầu quyền quản trị viên (Admin) để thực hiện thao tác này." },
        { status: 403 }
      );
    }

    // Forward user info via header so Route Handlers don't need to re-verify cookie
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-admin-id", session.user.id);
    requestHeaders.set("x-admin-email", session.user.email);
    requestHeaders.set("x-admin-role", session.user.role);
    requestHeaders.set("x-admin-name", encodeURIComponent(session.user.name));

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 2. Bảo vệ tất cả tuyến đường giao diện bắt đầu bằng /admin
  if (pathname.startsWith("/admin")) {
    const token = extractToken(req, true);

    // Nếu chưa đăng nhập -> Chuyển hướng đến /login với tham số redirect an toàn
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Xác minh chữ ký HMAC và thời hạn của session
    const session = await verifySessionToken(token);

    if (!session || !session.user) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_CONFIG.cookieName);
      return response;
    }

    // Kiểm tra phân quyền: Nếu không có role admin -> Chuyển hướng đến 403
    if (session.user.role !== "admin") {
      const forbiddenUrl = new URL("/403", req.url);
      return NextResponse.redirect(forbiddenUrl);
    }

    // Quyền Admin hợp lệ -> Cho phép truy cập
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Áp dụng Middleware trên đường dẫn /admin và /api/admin
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
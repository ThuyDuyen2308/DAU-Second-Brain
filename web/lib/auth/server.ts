// web/lib/auth/server.ts
import { cookies, headers } from "next/headers";
import { AUTH_CONFIG } from "./config";
import { verifySessionToken } from "./session";
import { AuthUser } from "./types";

/**
 * Lấy thông tin người dùng hiện tại từ:
 * 1. Authorization: Bearer <token> header (từ request hoặc next/headers)
 * 2. HTTP-Only Session Cookie trong Server Component / Route Handler
 */
export async function getCurrentUser(req?: Request): Promise<AuthUser | null> {
  try {
    // 1. Kiểm tra header Authorization từ request object nếu được truyền vào
    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const session = await verifySessionToken(token);
          if (session?.user) return session.user;
        }
      }
    }

    // 2. Kiểm tra header Authorization từ next/headers
    try {
      const headerList = await headers();
      const authHeader = headerList.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const session = await verifySessionToken(token);
          if (session?.user) return session.user;
        }
      }
    } catch {
      // Bỏ qua nếu không trong ngữ cảnh request có headers()
    }

    // 3. Kiểm tra HTTP-Only Cookies
    const cookieStore = await cookies();

    // 3.1. Kiểm tra cookie admin riêng biệt trước
    const adminToken = cookieStore.get(AUTH_CONFIG.adminCookieName)?.value;
    if (adminToken) {
      const adminSession = await verifySessionToken(adminToken);
      if (adminSession?.user?.role === "admin") {
        return adminSession.user;
      }
    }

    // 3.2. Fallback về cookie chung
    const token = cookieStore.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    return session ? session.user : null;
  } catch {
    return null;
  }
}

// web/lib/auth/server.ts
import { cookies } from "next/headers";
import { AUTH_CONFIG } from "./config";
import { verifySessionToken } from "./session";
import { AuthUser } from "./types";

/**
 * Lấy thông tin người dùng hiện tại từ HTTP-Only Session Cookie trong Server Component / Route Handler
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();

    // 1. Kiểm tra cookie admin riêng biệt trước (nếu có)
    const adminToken = cookieStore.get(AUTH_CONFIG.adminCookieName)?.value;
    if (adminToken) {
      const adminSession = await verifySessionToken(adminToken);
      if (adminSession?.user?.role === "admin") {
        return adminSession.user;
      }
    }

    // 2. Fallback về cookie chung
    const token = cookieStore.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    return session ? session.user : null;
  } catch {
    return null;
  }
}

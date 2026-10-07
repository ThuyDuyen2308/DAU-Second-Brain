// web/lib/auth/server.ts
import { cookies, headers } from "next/headers";
import { AUTH_CONFIG } from "./config";
import { verifySessionToken } from "./session";
import { AuthUser } from "./types";

/**
 * Lấy thông tin người dùng hiện tại.
 * Đầu tiên đọc từ x-admin-* headers do Middleware inject (nhanh, không re-verify).
 * Fallback về cookie nếu không có headers (ví dụ trong Server Components).
 */
export async function getCurrentUser(_req?: Request): Promise<AuthUser | null> {
  try {
    // 1. Đọc user từ headers do Middleware inject (chỉ có trong Route Handlers sau khi middleware pass)
    try {
      const headerList = await headers();
      const adminId = headerList.get("x-admin-id");
      const adminEmail = headerList.get("x-admin-email");
      const adminRole = headerList.get("x-admin-role");
      const adminNameEncoded = headerList.get("x-admin-name");

      if (adminId && adminEmail && adminRole) {
        return {
          id: adminId,
          email: adminEmail,
          role: adminRole as "admin" | "student",
          name: adminNameEncoded ? decodeURIComponent(adminNameEncoded) : adminEmail,
        };
      }
    } catch {
      // Không phải trong Route Handler context
    }

    // 2. Fallback: đọc cookie (dùng trong Server Components)
    const cookieStore = await cookies();

    const adminToken = cookieStore.get(AUTH_CONFIG.adminCookieName)?.value;
    if (adminToken) {
      const adminSession = await verifySessionToken(adminToken);
      if (adminSession?.user?.role === "admin") {
        return adminSession.user;
      }
    }

    const token = cookieStore.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    return session ? session.user : null;
  } catch {
    return null;
  }
}

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
    const token = cookieStore.get(AUTH_CONFIG.cookieName)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    return session ? session.user : null;
  } catch {
    return null;
  }
}

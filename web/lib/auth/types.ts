// web/lib/auth/types.ts
/**
 * Định nghĩa kiểu dữ liệu người dùng và phiên làm việc (Session)
 */

export type UserRole = "admin" | "student";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface SessionPayload {
  user: AuthUser;
  iat: number; // Issued at (timestamp ms)
  exp: number; // Expires at (timestamp ms)
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AuthUser;
}

export interface CurrentUserResponse {
  authenticated: boolean;
  user?: AuthUser;
}

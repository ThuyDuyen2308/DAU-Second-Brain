// web/lib/auth.ts
// Auth utilities for DAU Second Brain (Demo Server-side Authentication & Role-based Authorization)

export * from "./auth/types";
export * from "./auth/config";
export * from "./auth/session";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
}

export const MOCK_USER: MockUser | null = null;

/**
 * Kiểm tra định dạng email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Kiểm tra mật khẩu tối thiểu 6 ký tự
 */
export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 6;
}

/**
 * Trạng thái backend authentication: Server-Side Session with HTTP-only cookie (HMAC signed)
 */
export const AUTH_BACKEND_STATUS = "SERVER_SESSION_DEMO" as const;

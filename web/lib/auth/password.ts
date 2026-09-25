// web/lib/auth/password.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Băm mật khẩu an toàn bằng bcrypt với 12 salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Kiểm tra mật khẩu thuần với chuỗi hash đã lưu trong database
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

/**
 * Kiểm tra độ mạnh của mật khẩu: tối thiểu 6 ký tự
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Mật khẩu không được để trống." };
  }
  if (password.length < 6) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 6 ký tự." };
  }
  return { valid: true };
}
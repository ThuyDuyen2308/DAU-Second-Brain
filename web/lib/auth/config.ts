// web/lib/auth/config.ts
/**
 * Cấu hình hệ thống xác thực và phân quyền DAU-Second-Brain
 * Hỗ trợ nạp cấu hình tài khoản qua environment variables (file .env.local).
 */

export const AUTH_CONFIG = {
  // Tên cookie lưu trữ phiên làm việc
  cookieName: "dau_session",

  // Thời hạn phiên: 8 giờ (đơn vị giây)
  sessionMaxAge: 8 * 60 * 60,

  // Khóa bí mật dùng ký HMAC-SHA256 phiên làm việc (không bao giờ lộ ra client)
  secret: process.env.AUTH_SECRET || "dau_second_brain_session_secret_hmac_2026",

  // Tài khoản Admin Demo
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@dau.edu.vn").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "admin123",
    name: "Quản trị viên DAU",
    role: "admin" as const,
  },

  // Tài khoản Sinh viên Demo (để kiểm thử phân quyền và trang 403)
  student: {
    email: (process.env.STUDENT_EMAIL || "student@dau.edu.vn").trim().toLowerCase(),
    password: process.env.STUDENT_PASSWORD || "student123",
    name: "Sinh viên DAU",
    role: "student" as const,
  },
};

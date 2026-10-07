// app/forgot-password/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { isValidEmail } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập email tài khoản.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Định dạng email không hợp lệ (ví dụ: student@dau.edu.vn).");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Không thể xử lý yêu cầu lúc này.");
        return;
      }

      setSubmitted(true);
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err) {
      console.error("Lỗi gửi yêu cầu quên mật khẩu:", err);
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Khôi phục mật khẩu"
      subtitle="Nhập email sinh viên hoặc quản trị để nhận liên kết đặt lại mật khẩu"
    >
      {submitted ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 leading-relaxed">
            <div className="font-bold text-sm text-emerald-900 mb-1 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Đã tạo yêu cầu khôi phục mật khẩu
            </div>
            <p className="mb-2 text-slate-700">
              Hệ thống đã ghi nhận yêu cầu cho email: <span className="font-semibold text-slate-900">{email}</span>
            </p>
            <p className="text-slate-600">
              Liên kết đặt lại mật khẩu có hiệu lực trong vòng <strong className="text-slate-800">1 giờ</strong>.
            </p>
          </div>

          {resetUrl && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900">
              <div className="font-semibold mb-1.5 text-blue-950">
                🔗 Liên kết đặt lại mật khẩu:
              </div>
              <Link
                href={resetUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition-colors shadow-xs"
              >
                Tiếp tục đặt lại mật khẩu mới →
              </Link>
            </div>
          )}

          <Link
            href="/login"
            className="block text-center text-xs font-semibold text-blue-600 hover:underline pt-2"
          >
            ← Quay lại trang Đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <Input
            label="Email tài khoản"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Nhập email (ví dụ: student@dau.edu.vn)"
            error={error || undefined}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
            {loading ? "Đang xử lý..." : "Gửi yêu cầu khôi phục"}
          </Button>

          <div className="text-center text-xs text-slate-600 pt-2">
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              ← Quay lại trang Đăng nhập
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

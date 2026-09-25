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
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Vui lòng nhập email sinh viên.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Định dạng email không hợp lệ.");
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <AuthLayout
      title="Khôi phục mật khẩu"
      subtitle="Nhập email sinh viên để nhận liên kết đặt lại mật khẩu"
    >
      {submitted ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed">
            <div className="font-bold text-sm text-blue-950 mb-1">
              Đã ghi nhận yêu cầu khôi phục
            </div>
            <p className="mb-2">
              Email xác nhận: <span className="font-semibold">{email}</span>
            </p>
            <p className="text-slate-600">
              Chức năng khôi phục mật khẩu sẽ được tích hợp khi hệ thống xác thực hoàn thiện.
            </p>
          </div>

          <Link
            href="/login"
            className="block text-center text-xs font-semibold text-blue-600 hover:underline pt-2"
          >
            ← Quay lại trang Đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email sinh viên"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sinhvien@dau.edu.vn"
            error={error || undefined}
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <Button type="submit" variant="primary" size="md" className="w-full">
            Gửi yêu cầu khôi phục
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

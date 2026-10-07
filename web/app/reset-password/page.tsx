// app/reset-password/page.tsx
"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-5">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
          <div className="font-bold text-sm text-amber-950 mb-1">
            Thiếu mã khôi phục
          </div>
          <p className="text-slate-600">
            Không tìm thấy mã token đặt lại mật khẩu trong đường dẫn. Vui lòng kiểm tra lại liên kết hoặc gửi lại yêu cầu mới.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="block text-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition-colors shadow-xs"
        >
          Gửi lại yêu cầu khôi phục
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword) {
      setError("Vui lòng nhập mật khẩu mới.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Không thể đặt lại mật khẩu. Token có thể đã hết hạn hoặc đã được sử dụng.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Lỗi đặt lại mật khẩu:", err);
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 leading-relaxed">
          <div className="font-bold text-sm text-emerald-900 mb-1 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Đặt lại mật khẩu thành công
          </div>
          <p className="text-slate-700">
            Mật khẩu mới của bạn đã được cập nhật an toàn. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Đăng nhập ngay
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="relative">
        <Input
          label="Mật khẩu mới"
          type={showPassword ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Tối thiểu 6 ký tự"
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 text-xs font-semibold select-none cursor-pointer"
          tabIndex={-1}
        >
          {showPassword ? "Ẩn" : "Hiện"}
        </button>
      </div>

      <Input
        label="Xác nhận mật khẩu mới"
        type={showPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Nhập lại mật khẩu mới"
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
        {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
      </Button>

      <div className="text-center text-xs text-slate-600 pt-2">
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          ← Quay lại trang Đăng nhập
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      subtitle="Thiết lập mật khẩu mới cho tài khoản của bạn"
    >
      <Suspense fallback={<div className="text-center py-6 text-xs text-slate-400">Đang tải...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}

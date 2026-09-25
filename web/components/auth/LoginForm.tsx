// components/auth/LoginForm.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { isValidEmail } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  // Validate redirect path to prevent open redirect vulnerabilities
  const getSafeRedirect = (url: string | null): string | null => {
    if (!url) return null;
    // Bắt buộc bắt đầu bằng / và không được bắt đầu bằng //
    if (url.startsWith("/") && !url.startsWith("//")) {
      return url;
    }
    return null;
  };

  const safeRedirect = getSafeRedirect(redirectParam);
  const isAdminRedirect = safeRedirect?.startsWith("/admin");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = "Vui lòng nhập email sinh viên hoặc quản trị.";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Định dạng email không hợp lệ (ví dụ: admin@dau.edu.vn).";
    }

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 6) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrors({
          general: data.message || "Email hoặc mật khẩu không chính xác.",
        });
        return;
      }

      // Xử lý chuyển hướng sau khi đăng nhập thành công
      router.refresh();

      if (safeRedirect) {
        router.push(safeRedirect);
      } else if (data.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      setErrors({ general: "Không thể kết nối đến máy chủ xác thực." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Banner thông báo chuyển hướng nếu yêu cầu Admin */}
      {isAdminRedirect && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="font-medium">Đăng nhập để tiếp tục đến khu vực quản trị.</span>
        </div>
      )}

      {/* Thông báo lỗi tổng quát */}
      {errors.general && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">{errors.general}</span>
        </div>
      )}

      <Input
        label="Email tài khoản"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@dau.edu.vn hoặc student@dau.edu.vn"
        error={errors.email}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
      />

      <div className="relative">
        <Input
          label="Mật khẩu"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          error={errors.password}
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

      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <Link
          href="/forgot-password"
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          Quên mật khẩu?
        </Link>
      </div>

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
        {loading ? "Đang xác thực..." : "Đăng nhập"}
      </Button>

      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <span className="relative px-3 bg-white text-xs text-slate-400 uppercase tracking-wider font-semibold">
          hoặc
        </span>
      </div>

      <div className="text-center text-xs text-slate-600">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1"
        >
          Đăng ký tài khoản mới
        </Link>
      </div>
    </form>
  );
}

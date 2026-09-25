// components/auth/RegisterForm.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { isValidEmail } from "@/lib/auth";

export default function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    agreeTerms?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Vui lòng nhập họ và tên sinh viên.";
    }

    if (!email.trim()) {
      newErrors.email = "Vui lòng nhập email sinh viên.";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Định dạng email không hợp lệ (ví dụ: student@dau.edu.vn).";
    }

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 6) {
      newErrors.password = "Mật khẩu phải có tối thiểu 6 ký tự.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = "Bạn cần đồng ý với điều khoản sử dụng.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setServerError(data.message || "Đăng ký thất bại. Vui lòng thử lại.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Đăng ký thành công! Đang chuyển hướng vào hệ thống...");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setServerError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-start gap-2">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <Input
        label="Họ và tên sinh viên"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Nguyễn Văn A"
        error={errors.fullName}
        disabled={isSubmitting}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      />

      <Input
        label="Email sinh viên"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="student@dau.edu.vn"
        error={errors.email}
        disabled={isSubmitting}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
      />

      <Input
        label="Mật khẩu"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Tối thiểu 6 ký tự"
        error={errors.password}
        disabled={isSubmitting}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      />

      <Input
        label="Xác nhận mật khẩu"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Nhập lại mật khẩu"
        error={errors.confirmPassword}
        disabled={isSubmitting}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />

      <div>
        <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 select-none">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5"
          />
          <span>
            Tôi đồng ý với{" "}
            <span className="font-semibold text-blue-600 hover:underline">
              Điều khoản sử dụng
            </span>{" "}
            và quy định tra cứu văn bản của DAU.
          </span>
        </label>
        {errors.agreeTerms && (
          <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.agreeTerms}</p>
        )}
      </div>

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Đang xử lý đăng ký..." : "Đăng ký tài khoản"}
      </Button>

      <div className="text-center text-xs text-slate-600 pt-2">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1"
        >
          Đăng nhập ngay
        </Link>
      </div>
    </form>
  );
}
// app/login/page.tsx
import { Suspense } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập | DAU Second Brain",
  description: "Đăng nhập tài khoản tra cứu văn bản DAU Second Brain",
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục tra cứu và quản lý văn bản quan tâm"
    >
      <Suspense fallback={<div className="text-center text-xs text-slate-400 py-4">Đang tải biểu mẫu đăng nhập...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

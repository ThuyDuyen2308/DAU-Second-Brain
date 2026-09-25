// app/register/page.tsx
import AuthLayout from "@/components/auth/AuthLayout";
import RegisterForm from "@/components/auth/RegisterForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | DAU Second Brain",
  description: "Tạo tài khoản tra cứu văn bản sinh viên DAU Second Brain",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Tạo tài khoản mới"
      subtitle="Đăng ký tài khoản sinh viên để trải nghiệm hệ thống tra cứu chuẩn hóa"
    >
      <RegisterForm />
    </AuthLayout>
  );
}

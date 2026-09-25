// web/app/403/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";

export default function ForbiddenPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center animate-in zoom-in-95 duration-200">
        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center mb-6 shadow-sm">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          Mã lỗi: 403 Forbidden
        </span>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-4 mb-2">
          Không có quyền truy cập
        </h1>

        <p className="text-xs text-slate-600 leading-relaxed mb-8">
          Tài khoản hiện tại của bạn không có quyền truy cập vào phân hệ quản trị hệ thống DAU Second Brain. Vui lòng liên hệ cán bộ quản lý hoặc đăng nhập lại bằng tài khoản Admin.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link href="/" className="w-full">
            <Button variant="secondary" size="md" className="w-full">
              Về trang chủ
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </Button>
        </div>
      </div>
    </div>
  );
}

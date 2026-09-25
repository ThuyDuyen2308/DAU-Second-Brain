// components/auth/AuthLayout.tsx
import Link from "next/link";
import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Cột trái: Brand Visual Panel (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 p-10 flex-col justify-between text-white relative overflow-hidden">
          {/* Background subtle visual lines */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,100 M100,0 L0,100" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>

          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-base shadow-sm">
                DAU
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight block leading-none">
                  DAU Second Brain
                </span>
                <span className="text-[10px] text-blue-200">
                  Trợ lý văn bản nhà trường
                </span>
              </div>
            </Link>

            <h2 className="text-2xl font-bold tracking-tight text-white mb-3">
              Tra cứu thông tin nhà trường dễ dàng hơn.
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Truy cập tài khoản để đồng bộ các văn bản quan tâm, nhận gợi ý quy định học tập và trải nghiệm hệ thống tra cứu chuẩn hóa.
            </p>
          </div>

          {/* Document mock preview card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-xs space-y-2 mt-8">
            <div className="flex items-center justify-between text-[11px] text-blue-200">
              <span>TRƯỜNG ĐH KIẾN TRÚC ĐÀ NẴNG</span>
              <span className="bg-blue-500/30 px-2 py-0.5 rounded-full text-white">Mẫu</span>
            </div>
            <div className="font-semibold text-white text-sm line-clamp-1">
              Thông báo nộp học phí & khảo sát học phần
            </div>
            <p className="text-slate-300 text-[11px] line-clamp-2">
              Toàn bộ dữ liệu được số hóa bằng OCR tiếng Việt và chuẩn hóa theo schema học thuật.
            </p>
          </div>

          <div className="text-[11px] text-slate-400 pt-6">
            © 2026 DAU Second Brain. Trường Đại học Kiến trúc Đà Nẵng.
          </div>
        </div>

        {/* Cột phải: Form Card */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                {subtitle}
              </p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

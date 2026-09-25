// components/Footer.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Ẩn Footer ở trang chủ (/), trang hỏi đáp (/ask) và trang admin (/admin)
  // để giữ trải nghiệm full-height ChatGPT-like
  if (pathname === "/" || pathname === "/ask" || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Cột 1: Thông tin sản phẩm */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                  <path d="M6 10h10" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight block">
                  DAU Second Brain
                </span>
                <span className="text-xs text-slate-400 block">
                  Trợ lý tra cứu văn bản nhà trường
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Hệ thống kho tri thức số hỗ trợ sinh viên và giảng viên tra cứu nhanh,
              chính xác các thông báo, quy định đào tạo, học phí và chuẩn đầu ra của
              Trường Đại học Kiến trúc Đà Nẵng.
            </p>

            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p>Trường Đại học Kiến trúc Đà Nẵng</p>
              <p className="text-slate-400">* Đang chạy trên bộ dữ liệu mẫu để kiểm thử giao diện đồ án.</p>
            </div>
          </div>

          {/* Cột 2: Điều hướng nhanh */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">
              Khám phá
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-white transition-colors">
                  Tra cứu văn bản
                </Link>
              </li>
              <li>
                <Link href="/ask" className="hover:text-white transition-colors">
                  Hỏi đáp
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-white transition-colors">
                  Chủ đề văn bản
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 3: Nguồn dữ liệu chính thức */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">
              Nguồn văn bản
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://sinhvien.dau.edu.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Cổng thông tin sinh viên</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
              <li>
                <a
                  href="https://dau.edu.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Website trường DAU</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bản quyền */}
        <div className="pt-8 mt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 DAU Second Brain. Đồ án nghiên cứu & phát triển ứng dụng tra cứu văn bản số.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-slate-300">Đăng nhập</Link>
            <Link href="/register" className="hover:text-slate-300">Đăng ký</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-xs">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-3">
        Lỗi 404 • Không tìm thấy
      </span>

      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
        Văn bản hoặc trang không tồn tại
      </h1>

      <p className="text-sm text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
        Mã định danh văn bản bạn đang tìm kiếm không có trong kho lưu trữ số hóa của Trường Đại học Kiến trúc Đà Nẵng hoặc đã được cập nhật đường dẫn mới.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/documents"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
        >
          Quay lại danh sách văn bản
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

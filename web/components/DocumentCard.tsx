// components/DocumentCard.tsx
import Link from "next/link";
import { Document } from "@/types/document";
import StatusBadge from "./StatusBadge";

interface DocumentCardProps {
  document: Document;
}

export default function DocumentCard({ document }: DocumentCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all p-6 flex flex-col justify-between shadow-xs">
      <div>
        {/* Hàng trên cùng: Category + Số hiệu + StatusBadge */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {document.category ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {document.category}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                Thông báo
              </span>
            )}
            {document.document_number ? (
              <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                Số: {document.document_number}
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">Chưa xác định số VB</span>
            )}
          </div>
          <StatusBadge status={document.effective_status} size="sm" />
        </div>

        {/* Tiêu đề văn bản */}
        <Link href={`/documents/${document.id}`} className="group block mb-3">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {document.title}
          </h3>
        </Link>

        {/* Đoạn trích nội dung */}
        <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed font-normal">
          {document.content || "Văn bản chưa có bản trích xuất nội dung."}
        </p>
      </div>

      {/* Chân thẻ: Metadata & Xem chi tiết */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{document.issue_date || "Chưa rõ ngày"}</span>
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{document.total_pages} trang</span>
          </span>
        </div>

        <Link
          href={`/documents/${document.id}`}
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <span>Xem chi tiết</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

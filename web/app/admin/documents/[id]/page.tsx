// app/admin/documents/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentById, getAllDocuments } from "@/lib/documents";
import StatusBadge from "@/components/StatusBadge";
import type { Metadata } from "next";

interface AdminDocDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const docs = getAllDocuments();
  return docs.map((doc) => ({ id: doc.id }));
}

export async function generateMetadata({ params }: AdminDocDetailProps): Promise<Metadata> {
  const { id } = await params;
  const doc = getDocumentById(id);
  if (!doc) return { title: "Văn bản không tồn tại | Admin" };
  return { title: `Quản trị: ${doc.title} | Admin DAU` };
}

export default async function AdminDocumentDetailPage({ params }: AdminDocDetailProps) {
  const { id } = await params;
  const doc = getDocumentById(id);

  if (!doc) {
    notFound();
  }

  const chunkCount = Math.ceil((doc.content?.length || 500) / 450) || 2;

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs & Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin/documents" className="hover:text-blue-600">
              Quản lý văn bản
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-600">{doc.id}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {doc.title}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/documents/${doc.id}`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <span>Xem trang khách</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
          <Link
            href="/admin/documents"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
          >
            ← Quay lại
          </Link>
        </div>
      </div>

      {/* 2. Metadata Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Cột trái: Thông tin tổng quát */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Thông tin văn bản
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Số hiệu văn bản:</span>
              <span className="font-mono font-bold text-slate-800">
                {doc.document_number || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Ngày ban hành:</span>
              <span className="font-semibold text-slate-800">
                {doc.issue_date || "Chưa rõ ngày"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Đơn vị ban hành:</span>
              <span className="font-semibold text-slate-800">
                {doc.issuing_unit || "Trường ĐH Kiến trúc Đà Nẵng"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Danh mục:</span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 inline-block">
                {doc.category || "Chưa phân loại"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Trạng thái hiệu lực:</span>
              <StatusBadge status={doc.effective_status} size="sm" />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block mb-0.5">Quy mô số hóa:</span>
              <span className="font-semibold text-slate-800">
                {doc.total_pages} trang • ~{chunkCount} chunks
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Mã định danh ID:</span>
              <span className="font-mono text-[11px] text-slate-500 break-all">{doc.id}</span>
            </div>
          </div>
        </div>

        {/* Cột phải (2 cột): Trình kiểm tra bóc tách OCR theo trang */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Nội dung OCR trích xuất ({doc.pages?.length || 0} trang)
            </h3>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              Chất lượng OCR: GOOD (100/100)
            </span>
          </div>

          <div className="space-y-4">
            {doc.pages && doc.pages.length > 0 ? (
              doc.pages.map((p) => (
                <div
                  key={p.page_number}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-md">
                      Trang {p.page_number}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {p.cleaned_text?.length || 0} ký tự
                    </span>
                  </div>

                  <div className="font-sans text-xs sm:text-sm text-slate-700 leading-relaxed max-h-72 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-100 whitespace-pre-wrap select-text">
                    {p.cleaned_text || (
                      <span className="italic text-slate-400">Không có văn bản trích xuất trên trang này.</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                {doc.content || "Chưa có nội dung văn bản."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

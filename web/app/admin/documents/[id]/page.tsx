// app/admin/documents/[id]/page.tsx
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocumentById, getAllDocuments } from "@/lib/documents";
import { createChunksFromDocuments } from "@/lib/ai/chunking";
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

  // Tạo các chunks thực tế của tài liệu này
  const docChunks = createChunksFromDocuments([doc]);

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
            <span>Xem trang công khai</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>
      </div>

      {/* 2. Metadata Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider text-slate-400">
          Thông tin chi tiết & Siêu dữ liệu
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 font-bold block mb-1">Số hiệu văn bản</span>
            <span className="font-extrabold text-slate-900 text-sm">
              {doc.document_number || "Chưa cấp số"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block mb-1">Ngày ban hành</span>
            <span className="font-semibold text-slate-800">
              {doc.issue_date || "Chưa cập nhật"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block mb-1">Danh mục</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              {doc.category || "Chưa phân loại"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block mb-1">Tổng số trang / Chunks</span>
            <span className="font-bold text-blue-600">
              {doc.total_pages || 1} trang ({docChunks.length} chunks)
            </span>
          </div>
        </div>

        {/* Khối Tình trạng hiệu lực & Căn cứ kiểm toán */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">Tình trạng hiệu lực văn bản:</span>
            <StatusBadge status={doc.effective_status} isVerified={doc.is_verified} size="md" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Hạn thực hiện (Deadline):</span>
              <span className="font-mono font-bold text-indigo-700">
                {doc.deadline || "Không quy định hạn chót"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Ngày có hiệu lực:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {doc.effective_from || (doc.issue_date ? `Từ ngày ban hành (${doc.issue_date})` : "—")}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Ngày hết hiệu lực:</span>
              <span className="font-mono text-slate-700">
                {doc.effective_to || "Chưa quy định"}
              </span>
            </div>
          </div>

          {doc.replaced_by && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              <strong>Văn bản thay thế:</strong> {doc.replaced_by}
            </div>
          )}

          {doc.status_evidence && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-700 block">🔍 Căn cứ trích dẫn từ văn bản nguồn:</span>
              <p className="font-mono italic text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                {doc.status_evidence}
              </p>
              {doc.status_rationale && (
                <p className="text-[11px] text-slate-600 pt-1">
                  <strong>Phân tích:</strong> {doc.status_rationale}
                </p>
              )}
            </div>
          )}

          {/* Thông tin kiểm toán Admin */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>
              {doc.is_verified ? (
                <span className="text-blue-700 font-semibold">
                  ✓ Đã được Admin ({doc.verified_by || "Admin"}) xác minh vào {doc.verified_at?.slice(0, 19).replace("T", " ")}
                </span>
              ) : (
                <span className="text-amber-700">
                  ⚠️ Trạng thái đề xuất tự động từ Pipeline OCR (Chưa được Admin duyệt thủ công)
                </span>
              )}
            </span>
            <Link
              href="/admin/documents"
              className="text-blue-600 hover:underline font-bold"
            >
              Chỉnh sửa hiệu lực trên Quản lý tài liệu →
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Phân đoạn tri thức Chunks (Second Brain Breakdowns) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>🧠 Phân đoạn tri thức (Chunks) trong Second Brain</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Văn bản được tự động bóc tách và chia nhỏ thành {docChunks.length} đơn vị ngữ cảnh RAG
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            {docChunks.length} chunks
          </span>
        </div>

        <div className="space-y-3">
          {docChunks.map((chunk, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md text-[10px]">
                  Chunk #{idx + 1} • Trang {chunk.pageNumber}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ID: {chunk.chunkId}
                </span>
              </div>
              <p className="text-slate-800 leading-relaxed font-mono whitespace-pre-wrap bg-white p-3 rounded-xl border border-slate-200">
                {chunk.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Page Content OCR Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-base font-extrabold text-slate-900">
          Nội dung bóc tách OCR theo trang
        </h3>

        {doc.pages && doc.pages.length > 0 ? (
          <div className="space-y-4">
            {doc.pages.map((p) => (
              <div key={p.page_number} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span>Trang {p.page_number}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {(p.cleaned_text || p.raw_text || "").length} ký tự
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {p.cleaned_text || p.raw_text || "Chưa có dữ liệu trang."}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
            {doc.content || "Chưa có nội dung."}
          </div>
        )}
      </div>
    </div>
  );
}

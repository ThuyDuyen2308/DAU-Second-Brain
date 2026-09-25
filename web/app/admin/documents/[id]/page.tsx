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
            <StatusBadge status={doc.category} />
          </div>
          <div>
            <span className="text-slate-400 font-bold block mb-1">Tổng số trang / Chunks</span>
            <span className="font-bold text-blue-600">
              {doc.total_pages || 1} trang ({docChunks.length} chunks)
            </span>
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

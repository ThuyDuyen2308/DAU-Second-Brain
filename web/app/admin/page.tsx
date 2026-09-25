// app/admin/page.tsx
import React from "react";
import Link from "next/link";
import { getAllDocuments, getRecentDocuments } from "@/lib/documents";
import StatusBadge from "@/components/StatusBadge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tổng quan hệ thống | DAU Second Brain Admin",
  description: "Trang quản trị kho tri thức và giám sát hoạt động hệ thống DAU Second Brain",
};

export default function AdminDashboardPage() {
  const allDocs = getAllDocuments();
  const recentDocs = getRecentDocuments(5);

  const totalDocuments = allDocs.length;
  const totalPages = allDocs.reduce((acc, d) => acc + (d.total_pages || 0), 0);
  const totalChunks = 56; // 56 exact text chunks đã kiểm toán ở Bước 12

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <span>Bảng điều khiển</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Tổng quan hệ thống
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
          Quản lý kho tri thức và hoạt động hỏi đáp của DAU-Second-Brain.
        </p>
      </div>

      {/* 2. 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Stat 1: Văn bản */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Văn bản
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalDocuments}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đã chuẩn hóa schema JSON</p>
        </div>

        {/* Stat 2: Trang OCR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Trang OCR
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalPages}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Trích xuất tiếng Việt vie+eng</p>
        </div>

        {/* Stat 3: Chunks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Chunks
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalChunks}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đơn vị ngữ cảnh cho RAG</p>
        </div>

        {/* Stat 4: Câu hỏi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Câu hỏi
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
              Demo
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-700 mt-2">
            Chưa có dữ liệu
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Chưa kết nối database lưu lịch sử</p>
        </div>
      </div>

      {/* 3. Thao tác nhanh (Quick Actions) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Thao tác nhanh
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/documents/new"
            className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 text-blue-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-2xs"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Thêm văn bản</span>
          </Link>
          <Link
            href="/admin/documents"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Quản lý văn bản</span>
          </Link>
          <Link
            href="/admin/ai"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Xử lý dữ liệu AI</span>
          </Link>
          <Link
            href="/admin/questions"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Xem câu hỏi</span>
          </Link>
        </div>
      </div>

      {/* 4. Grid 2 cột: Tình trạng kho tri thức & Hoạt động hệ thống */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Cột trái: Tình trạng kho tri thức */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tình trạng kho tri thức
            </h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Đang hoạt động
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">Văn bản đã bóc tách:</span>
              <span className="font-bold text-slate-800">{totalDocuments} văn bản</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">Trang OCR số hóa:</span>
              <span className="font-bold text-slate-800">{totalPages} trang</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">Đoạn văn bản (Chunks):</span>
              <span className="font-bold text-slate-800">{totalChunks} đoạn</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">Chỉ mục Semantic Index:</span>
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                Chưa cấu hình provider thật
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500">Chế độ hỏi đáp mặc định:</span>
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                Trích xuất cục bộ (Local Extractive)
              </span>
            </div>
          </div>
        </div>

        {/* Cột phải: Hoạt động hệ thống gần đây */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Hoạt động hệ thống
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Dữ liệu demo
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 font-medium">Dataset kiểm toán chất lượng</span>
              </div>
              <span className="font-mono text-emerald-700 font-semibold">10/10 văn bản OK</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 font-medium">Citation Integrity Test</span>
              </div>
              <span className="font-mono text-emerald-700 font-semibold">7/7 PASS</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 font-medium">Hybrid Retrieval & Anti-Hallucination</span>
              </div>
              <span className="font-mono text-emerald-700 font-semibold">10/10 PASS</span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 font-medium">Next.js Turbopack Build</span>
              </div>
              <span className="font-mono text-emerald-700 font-semibold">PASS (0 lỗi TS)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Văn bản mới nhất từ dataset thật */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Văn bản trong kho tri thức ({recentDocs.length}/{totalDocuments})
          </h3>
          <Link
            href="/admin/documents"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Xem tất cả →
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {recentDocs.map((doc) => (
            <div
              key={doc.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl px-2 transition-colors"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>{doc.document_number || "Chưa có số VB"}</span>
                  <span>•</span>
                  <span>{doc.issue_date || "Chưa rõ ngày"}</span>
                  <span>•</span>
                  <span className="text-slate-600 font-sans font-medium">{doc.category || "Chưa phân loại"}</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">
                  {doc.title}
                </h4>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={doc.effective_status} size="sm" />
                <Link
                  href={`/admin/documents/${doc.id}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-colors"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

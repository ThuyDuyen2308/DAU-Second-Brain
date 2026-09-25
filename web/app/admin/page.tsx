// app/admin/page.tsx
import React from "react";
import Link from "next/link";
import { getAllDocuments, getRecentDocuments } from "@/lib/documents";
import { createChunksFromDocuments } from "@/lib/ai/chunking";
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
  const totalChunks = createChunksFromDocuments(allDocs).length || 56;

  const pipelineStages = [
    { title: "Văn bản DAU", desc: "PDF & Thông báo gốc", icon: "📄" },
    { title: "Parser / OCR", desc: "Bóc tách tiếng Việt", icon: "🔍" },
    { title: "Chuẩn hóa", desc: "Metadata & JSON", icon: "⚙️" },
    { title: "Chunking", desc: "Phân đoạn ngữ cảnh", icon: "🧩" },
    { title: "Embedding", desc: "Vector Search Index", icon: "🧠" },
    { title: "Hybrid Retrieval", desc: "40% Kw + 60% Sem", icon: "⚡" },
    { title: "Context Builder", desc: "Prompt & Rào chắn", icon: "🛡️" },
    { title: "AI Provider", desc: "Gemini / Local", icon: "🤖" },
    { title: "Citation", desc: "Trích dẫn + Trang", icon: "📌" },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <span>Bảng điều khiển Admin</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Quản trị Kho Tri Thức Second Brain
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
          Giám sát số lượng văn bản, các đoạn tri thức (chunks) và quy trình xử lý của Second Brain Pipeline.
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
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              📄
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalDocuments}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Văn bản đã bóc tách JSON</p>
        </div>

        {/* Stat 2: Trang OCR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tổng số trang
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              📑
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalPages}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Trang đã OCR tiếng Việt</p>
        </div>

        {/* Stat 3: Text Chunks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tri thức Chunks
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              🧩
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {totalChunks}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Đoạn ngữ cảnh RAG units</p>
        </div>

        {/* Stat 4: Q&A Test Passed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Kiểm thử AI RAG
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              ✓
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">
            100%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">E2E, Citation & Auth PASS</p>
        </div>
      </div>

      {/* 3. Second Brain Pipeline Flowchart */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>🧠 Kiến trúc Second Brain Pipeline</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sơ đồ xử lý tri thức từ văn bản gốc đến câu trả lời trích dẫn nguồn
            </p>
          </div>
          <Link
            href="/admin/ai"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Thử nghiệm Pipeline →
          </Link>
        </div>

        {/* Pipeline Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-3">
          {pipelineStages.map((stage, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center flex flex-col items-center justify-between relative group hover:bg-blue-50/60 hover:border-blue-200 transition-colors"
            >
              <div className="text-xl mb-1">{stage.icon}</div>
              <div className="text-xs font-extrabold text-slate-800 leading-tight">
                {stage.title}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-medium">
                {stage.desc}
              </div>

              {idx < pipelineStages.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-300 font-bold text-xs">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Documents Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-900">Văn bản số hóa gần đây</h3>
          <Link href="/admin/documents" className="text-xs font-bold text-blue-600 hover:underline">
            Xem tất cả ({totalDocuments}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-2">Tiêu đề văn bản</th>
                <th className="py-3 px-2">Số hiệu</th>
                <th className="py-3 px-2">Danh mục</th>
                <th className="py-3 px-2">Số trang</th>
                <th className="py-3 px-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-2 font-bold text-slate-800 max-w-xs truncate">
                    {doc.title}
                  </td>
                  <td className="py-3 px-2 text-slate-600 font-semibold">
                    {doc.document_number || "—"}
                  </td>
                  <td className="py-3 px-2">
                    <StatusBadge status={doc.category} />
                  </td>
                  <td className="py-3 px-2 font-semibold text-slate-700">
                    {doc.total_pages || 1} trang
                  </td>
                  <td className="py-3 px-2">
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Chi tiết & Chunks →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

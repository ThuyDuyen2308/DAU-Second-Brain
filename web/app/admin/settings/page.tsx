// app/admin/settings/page.tsx
import React from "react";
import { getAllDocuments } from "@/lib/documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cài đặt hệ thống | DAU Second Brain Admin",
  description: "Thông tin cấu hình và tham số vận hành hệ thống DAU Second Brain",
};

export default function AdminSettingsPage() {
  const allDocs = getAllDocuments();
  const totalDocuments = allDocs.length;
  const totalPages = allDocs.reduce((acc, d) => acc + (d.total_pages || 0), 0);
  const totalChunks = 56;

  return (
    <div className="max-w-4xl space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Cài đặt hệ thống
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Thông số cấu hình môi trường và kiến trúc vận hành DAU Second Brain.
        </p>
      </div>

      {/* 2. Thông tin hệ thống (System Information) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Thông tin hệ thống
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Tên đề tài:</span>
            <span className="font-bold text-slate-900">DAU Second Brain</span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Mục đích:</span>
            <span className="font-medium text-slate-800">
              Trợ lý tra cứu và hỏi đáp văn bản quy định nhà trường có trích dẫn nguồn
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Đơn vị ứng dụng:</span>
            <span className="font-medium text-slate-800">
              Trường Đại học Kiến trúc Đà Nẵng (DAU)
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Phiên bản:</span>
            <span className="font-mono font-semibold text-blue-600">v1.0 (Demo Đồ án)</span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Công nghệ nền tảng:</span>
            <span className="font-medium text-slate-700">Next.js 16 (Turbopack) • React • TypeScript • Tailwind CSS</span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Động cơ OCR:</span>
            <span className="font-medium text-slate-700">Tesseract OCR 5.5.0 (Ngôn ngữ: vie+eng)</span>
          </div>
        </div>
      </div>

      {/* 3. Cấu hình AI Provider (AI Configuration) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Cấu hình nhà cung cấp AI (AI Provider)
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Chưa cấu hình API Key
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Mô hình AI tạo sinh:</span>
            <span className="font-bold text-slate-800">Google Gemini (Endpoint v1beta)</span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Phiên bản Model mặc định:</span>
            <span className="font-mono font-semibold text-slate-700">gemini-1.5-flash</span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Khóa API (API Key):</span>
            <span className="font-mono text-slate-400">••••••••••••••••••••••••</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              (Bảo mật: Không nạp API key vào giao diện client-side)
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Cơ chế thay thế tự động (Fallback):</span>
            <span className="font-semibold text-emerald-700">
              DAU Local Extractive Synthesizer (Sẵn sàng 100%)
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed border border-slate-100">
          <span className="font-bold text-slate-800 block mb-1">Hướng dẫn cấu hình API Key:</span>
          Tạo tệp <code className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[11px]">web/.env.local</code> và khai báo biến <code className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[11px]">GEMINI_API_KEY=AIzaSy...</code> để kích hoạt mô hình sinh ngữ tự nhiên.
        </div>
      </div>

      {/* 4. Tình trạng Kho tri thức (Dataset Status) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
          Tình trạng lưu trữ kho tri thức
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Văn bản số hóa:</span>
            <span className="text-lg font-bold text-slate-900">{totalDocuments} văn bản</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Tổng số trang OCR:</span>
            <span className="text-lg font-bold text-slate-900">{totalPages} trang</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Tổng số đoạn Chunks:</span>
            <span className="text-lg font-bold text-slate-900">{totalChunks} chunks</span>
          </div>
        </div>

        <div className="text-xs space-y-1.5 pt-2 text-slate-500 font-mono text-[11px]">
          <div>Tệp dữ liệu chuẩn hóa: <code className="text-slate-700">crawler/data/normalized/documents.json</code></div>
          <div>Vị trí bộ nhớ đệm Vector: <code className="text-slate-700">web/data/embeddings/index.json</code></div>
        </div>
      </div>
    </div>
  );
}

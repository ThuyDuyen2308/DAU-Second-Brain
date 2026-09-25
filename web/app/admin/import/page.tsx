// web/app/admin/import/page.tsx
"use client";

import React, { useState } from "react";
import ImportDropzone from "@/components/admin/ImportDropzone";
import ImportQueue from "@/components/admin/ImportQueue";

export default function AdminImportPage() {
  const [activeMainTab, setActiveMainTab] = useState<"upload" | "queue">("upload");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header Trang */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Nhập tài liệu &amp; Bóc tách tri thức
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Tải lên tài liệu PDF, DOCX, HTML thật vào hệ thống, tự động bóc tách nội dung, duyệt metadata và đưa vào kho tri thức RAG.
          </p>
        </div>

        {/* Nút chuyển Tab chính */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveMainTab("upload")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === "upload"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Tải lên tài liệu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("queue")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === "queue"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Hàng đợi &amp; Duyệt</span>
          </button>
        </div>
      </div>

      {/* 2. Hướng dẫn & Quy định */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          ℹ️
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Quy trình xử lý tự động:</p>
          <p className="text-blue-800 leading-relaxed">
            1. File upload được lưu an toàn và xếp vào hàng đợi • 
            2. Worker bóc tách text (PDF, DOCX, HTML, OCR scan tiếng Việt) • 
            3. Admin kiểm tra bản xem trước và chỉnh sửa metadata • 
            4. Bấm <strong>Công bố</strong> để ghi an toàn vào kho RAG và tự động phục vụ sinh viên hỏi đáp.
          </p>
        </div>
      </div>

      {/* 3. Nội dung Tab */}
      {activeMainTab === "upload" ? (
        <ImportDropzone onUploadSuccess={() => setActiveMainTab("queue")} />
      ) : (
        <ImportQueue />
      )}
    </div>
  );
}
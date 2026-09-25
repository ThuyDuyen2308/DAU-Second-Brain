// app/admin/ai/page.tsx
"use client";

import React, { useState } from "react";

interface PipelineStep {
  id: string;
  name: string;
  category: "ingestion" | "retrieval" | "generation";
  status: "deployed" | "architecture_ready" | "not_configured" | "offline_ready";
  statusLabel: string;
  description: string;
  techDetails: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "step_1",
    name: "1. Bóc tách OCR & Chuẩn hóa",
    category: "ingestion",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Bóc tách text từ file scan PDF với động cơ Tesseract OCR và bộ lọc ảnh tiếng Việt (vie+eng).",
    techDetails: "10 văn bản, 20 trang, 100% Quality Audit GOOD",
  },
  {
    id: "step_2",
    name: "2. Phân mảnh (Chunking)",
    category: "ingestion",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Cắt nội dung thành các đoạn 300 - 750 ký tự, bảo toàn câu tiếng Việt và metadata số trang.",
    techDetails: "56 chunks có cấu trúc phân trang",
  },
  {
    id: "step_3",
    name: "3. Keyword Retrieval",
    category: "retrieval",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Trích xuất từ khóa, chuẩn hóa từ đồng nghĩa, ưu tiên số hiệu văn bản và kiểm soát từ dừng.",
    techDetails: "Boost số hiệu +35 điểm, Tiêu đề +20 điểm",
  },
  {
    id: "step_4",
    name: "4. Semantic Search (Vector)",
    category: "retrieval",
    status: "architecture_ready",
    statusLabel: "Đã triển khai kiến trúc",
    description: "Đo lường khoảng cách ngữ nghĩa thông qua vector embedding và thuật toán Cosine Similarity.",
    techDetails: "Vector Cosine Matching, Cache index JSON",
  },
  {
    id: "step_5",
    name: "5. Hybrid Ranking",
    category: "retrieval",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Kết hợp điểm số Keyword và Semantic theo trọng số 40% - 60%, tự động fallback khi thiếu key.",
    techDetails: "FinalScore = Kw*0.4 + Sem*0.6, Coverage threshold 40%",
  },
  {
    id: "step_6",
    name: "6. Context Builder & Anti-Hallucination",
    category: "generation",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Đóng gói ngữ cảnh có rào chắn System Prompt nghiêm ngặt, ngăn chặn AI suy đoán ngoài tài liệu.",
    techDetails: "Prompt neo giữ tài liệu, Compound Gating",
  },
  {
    id: "step_7",
    name: "7. Google Gemini 1.5 Flash",
    category: "generation",
    status: "not_configured",
    statusLabel: "Chưa cấu hình API key",
    description: "Mô hình ngôn ngữ tự nhiên tổng hợp câu trả lời mượt mà, hỗ trợ quota guard và timeout 15s.",
    techDetails: "Endpoint v1beta, sẵn sàng kích hoạt khi có key",
  },
  {
    id: "step_8",
    name: "8. Local Extractive Synthesizer",
    category: "generation",
    status: "offline_ready",
    statusLabel: "Đang sẵn sàng cho demo",
    description: "Bộ trích xuất câu văn nguyên bản từ tài liệu gốc, hoạt động ngoại tuyến và không tốn quota.",
    techDetails: "Mặc định kích hoạt khi chưa có GEMINI_API_KEY",
  },
  {
    id: "step_9",
    name: "9. Backend Citation Mapping",
    category: "generation",
    status: "deployed",
    statusLabel: "Đã triển khai",
    description: "Backend tự đối chiếu Document ID và số trang thực tế để tạo link `#page-n`, chống nguồn ảo.",
    techDetails: "100% Citation Integrity (7/7 PASS)",
  },
];

export default function AdminAiPage() {
  const [modalAction, setModalAction] = useState<string | null>(null);

  const getBadgeStyle = (status: PipelineStep["status"]) => {
    switch (status) {
      case "deployed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "architecture_ready":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "offline_ready":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "not_configured":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <span>AI Pipeline</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          AI & Kho tri thức
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
          Theo dõi và quản lý pipeline xử lý dữ liệu phục vụ hệ thống hỏi đáp DAU Second Brain.
        </p>
      </div>

      {/* 2. Pipeline Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Thao tác xử lý dữ liệu
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Quản lý và kích hoạt các script xử lý dữ liệu trong kho tri thức
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalAction("Build Embeddings (Vector Indexing)")}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Build Embeddings
          </button>
          <button
            type="button"
            onClick={() => setModalAction("Re-index Keyword Database")}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Re-index
          </button>
          <button
            type="button"
            onClick={() => setModalAction("Kiểm tra toàn vẹn Dataset")}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            Kiểm tra Dataset
          </button>
        </div>
      </div>

      {/* 3. Retrieval Configuration Parameters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Cấu hình thuật toán Hybrid Retrieval
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Trọng số Từ khóa (Keyword):</span>
            <span className="font-mono text-lg font-black text-slate-900">40%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Bắt số hiệu, ngày tháng</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Trọng số Ngữ nghĩa (Semantic):</span>
            <span className="font-mono text-lg font-black text-slate-900">60%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Hiểu ý định câu hỏi</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Ngưỡng bao phủ (Coverage):</span>
            <span className="font-mono text-lg font-black text-slate-900">≥ 40%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Chống ảo giác ngoài phạm vi</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block mb-1">Ưu tiên Số hiệu văn bản:</span>
            <span className="font-mono text-lg font-black text-blue-600">+35 điểm</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Định vị chính xác Top 1</span>
          </div>
        </div>
      </div>

      {/* 4. Sơ đồ các bước trong Pipeline (Pipeline Steps Cards) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Chi tiết 9 bước trong Pipeline xử lý
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PIPELINE_STEPS.map((step) => (
            <div
              key={step.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                    {step.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border ${getBadgeStyle(
                      step.status
                    )}`}
                  >
                    {step.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                {step.techDetails}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Modal cảnh báo an toàn cho AI Actions */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-slate-900">Thao tác: {modalAction}</h4>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed space-y-1.5">
              <p className="font-semibold text-slate-800">Thông báo kỹ thuật:</p>
              <p>
                Chức năng này đã có script xử lý tương ứng trong project (`web/scripts/build_embeddings.js` và `web/scripts/audit_dataset.js`) nhưng chưa được kết nối thành thao tác server-side trực tiếp từ trình duyệt để đảm bảo an toàn hệ thống.
              </p>
              <p className="text-slate-500 text-[11px]">
                Để thực thi trong môi trường dòng lệnh:
                <code className="block mt-1 p-1.5 bg-slate-200/70 rounded font-mono text-[10px] text-slate-800">
                  npm run embeddings:build
                </code>
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

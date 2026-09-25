// app/admin/questions/page.tsx
"use client";

import React, { useState } from "react";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

interface QuestionLogItem {
  id: string;
  question: string;
  timestamp: string;
  sourcesCount: number;
  modelUsed: string;
  status: "Thành công" | "Từ chối an toàn";
  isDemo: boolean;
}

const DEMO_QUESTIONS: QuestionLogItem[] = [
  {
    id: "q_1",
    question: "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
    timestamp: "2026-09-18 09:15:22",
    sourcesCount: 1,
    modelUsed: "DAU Local Extractive Synthesizer",
    status: "Thành công",
    isDemo: true,
  },
  {
    id: "q_2",
    question: "Tiền học kỳ đầu năm học 2026-2027 là bao nhiêu?",
    timestamp: "2026-09-18 09:18:40",
    sourcesCount: 1,
    modelUsed: "DAU Local Extractive Synthesizer",
    status: "Thành công",
    isDemo: true,
  },
  {
    id: "q_3",
    question: "Thủ tục phúc khảo bài thi như thế nào?",
    timestamp: "2026-09-18 09:22:15",
    sourcesCount: 1,
    modelUsed: "DAU Local Extractive Synthesizer",
    status: "Thành công",
    isDemo: true,
  },
  {
    id: "q_4",
    question: "Thông báo 34/TB-ĐHKTĐN nói về vấn đề gì?",
    timestamp: "2026-09-18 09:30:05",
    sourcesCount: 1,
    modelUsed: "DAU Local Extractive Synthesizer",
    status: "Thành công",
    isDemo: true,
  },
  {
    id: "q_5",
    question: "Trường có bao nhiêu ký túc xá?",
    timestamp: "2026-09-18 09:41:12",
    sourcesCount: 0,
    modelUsed: "DAU Local Extractive Synthesizer",
    status: "Từ chối an toàn",
    isDemo: true,
  },
];

export default function AdminQuestionsPage() {
  const [viewMode, setViewMode] = useState<"demo" | "empty">("demo");

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Lịch sử hỏi đáp
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Theo dõi các truy vấn và chất lượng câu trả lời từ hệ thống DAU Second Brain.
          </p>
        </div>

        {/* Chuyển đổi trạng thái demo / empty state */}
        <div className="flex items-center gap-2 text-xs bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("demo")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "demo" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Dữ liệu minh họa (5)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("empty")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "empty" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Trạng thái thực tế
          </button>
        </div>
      </div>

      {/* 2. Notice Disclaimer */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 className="font-bold text-slate-800">Tình trạng lưu trữ lịch sử câu hỏi</h4>
          <p className="mt-0.5 leading-relaxed">
            API hỏi đáp (`/api/ask`) hiện tại xử lý truy vấn trực tiếp và chưa kết nối cơ sở dữ liệu để lưu vết lịch sử tương tác của người dùng.
          </p>
        </div>
      </div>

      {/* 3. Content View */}
      {viewMode === "empty" ? (
        <AdminEmptyState
          title="Chưa có lịch sử hỏi đáp được lưu"
          description="Hệ thống xử lý trực tiếp các request và chưa kích hoạt cơ chế ghi log câu hỏi vào cơ sở dữ liệu máy chủ."
          actionLabel="Xem dữ liệu demo minh họa"
          onAction={() => setViewMode("demo")}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Nhật ký truy vấn minh họa
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Dữ liệu demo
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Dựa trên các test case của đồ án
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                  <th className="py-3 px-4">Câu hỏi</th>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3 text-center">Số nguồn</th>
                  <th className="py-3 px-3">Mô hình</th>
                  <th className="py-3 px-4 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DEMO_QUESTIONS.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-sm">
                      {q.question}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                      {q.timestamp}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                      {q.sourcesCount}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-100">
                        {q.modelUsed}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          q.status === "Thành công"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            q.status === "Thành công" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

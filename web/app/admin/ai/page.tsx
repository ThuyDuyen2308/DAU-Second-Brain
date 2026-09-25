// app/admin/ai/page.tsx
"use client";

import React, { useState } from "react";
import { AskResponse } from "@/types/ask";

export default function AdminAIPage() {
  const [testQuestion, setTestQuestion] = useState("Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  const sampleQueries = [
    "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
    "Thủ tục phúc khảo bài thi như thế nào?",
    "Tôi cần nộp giấy chứng nhận ngoại ngữ ở đâu?",
    "Thông báo 34/TB-ĐHKTĐN nói về vấn đề gì?",
  ];

  const handleRunPipeline = async (qText?: string) => {
    const text = (qText || testQuestion).trim();
    if (!text || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi mã ${res.status}`);
      }

      const data: AskResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("Lỗi test pipeline:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <span>Second Brain Inspector</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Trực quan hóa Pipeline AI & RAG
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
          Thử nghiệm quy trình xử lý 7 bước thực tế của Second Brain: từ câu hỏi đầu vào, phân tích từ khóa, điểm số tìm kiếm đến prompt ngữ cảnh và trích dẫn nguồn.
        </p>
      </div>

      {/* Test Control Box */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900">
          Chạy thử nghiệm Pipeline với câu hỏi thực tế
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={testQuestion}
            onChange={(e) => setTestQuestion(e.target.value)}
            placeholder="Nhập câu hỏi thử nghiệm..."
            className="flex-1 text-xs p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-medium"
          />
          <button
            type="button"
            onClick={() => handleRunPipeline()}
            disabled={loading || !testQuestion.trim()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex-shrink-0 cursor-pointer"
          >
            {loading ? "Đang chạy Pipeline..." : "Chạy Pipeline RAG"}
          </button>
        </div>

        {/* Sample query buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400 self-center">Mẫu:</span>
          {sampleQueries.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTestQuestion(sq);
                handleRunPipeline(sq);
              }}
              className="text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Results 7 Steps Visualizer */}
      {result && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Kết quả thực thi Second Brain Pipeline
            </h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Thực thi thành công
            </span>
          </div>

          <div className="space-y-6">
            {/* STEP 1: Question */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                Bước 1: Input Question
              </span>
              <p className="text-sm font-bold text-slate-900 mt-2">"{testQuestion}"</p>
            </div>

            {/* STEP 2: Retrieval Status */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                  Bước 2: Retrieval Engine
                </span>
                <span className="text-xs font-bold text-slate-700">
                  Tìm thấy {result.relevantDocumentsFound} đoạn văn bản liên quan
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Hybrid Search Engine (40% Keyword Match + 60% Semantic Cosine Similarity + 35p Số hiệu công văn).
              </p>
            </div>

            {/* STEP 3: Retrieved Chunks & Sources */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-[10px] font-extrabold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                Bước 3 & 4: Top Retrieved Chunks & Context
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.sources.map((src, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-blue-700">
                        {src.documentNumber || `Document ${idx + 1}`}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Trang {src.page}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800 line-clamp-1">{src.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic font-mono bg-slate-50 p-1.5 rounded-md">
                      "{src.snippet}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 5 & 6: AI Provider & Answer */}
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                  Bước 5 & 6: AI Generation ({result.modelUsed || "Local Synthesizer"})
                </span>
              </div>
              <div className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap bg-white p-4 rounded-xl border border-blue-100 shadow-2xs">
                {result.answer}
              </div>
            </div>

            {/* STEP 7: Backend Citations */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                Bước 7: Backend Citation Mapping
              </span>
              <div className="space-y-1 text-xs">
                {result.sources.map((src, idx) => (
                  <div key={idx} className="flex items-center gap-2 font-mono text-[11px] text-slate-700">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>URL Trích dẫn {idx + 1}:</span>
                    <span className="font-bold text-blue-600">{src.url}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

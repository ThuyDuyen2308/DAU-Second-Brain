// app/admin/settings/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AskResponse } from "@/types/ask";

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "ai" ? "ai" : searchParams.get("tab") === "services" ? "services" : "system";

  const [activeTab, setActiveTab] = useState<"system" | "ai" | "services">(initialTab);

  // State cho Thử nghiệm Pipeline AI
  const [testQuestion, setTestQuestion] = useState("Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "ai") setActiveTab("ai");
    else if (tabParam === "services") setActiveTab("services");
  }, [searchParams]);

  const sampleQueries = [
    "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
    "Thủ tục phúc khảo bài thi kết thúc học phần như thế nào?",
    "Quy định nộp chứng chỉ chuẩn đầu ra ngoại ngữ, tin học?",
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
      alert("Lỗi khi chạy thử nghiệm: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* 1. Header Trang & Tab chuyển đổi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Cài đặt &amp; Kỹ thuật hệ thống
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Giám sát cấu hình môi trường, kiểm thử Pipeline AI/RAG và trạng thái các dịch vụ bóc tách.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "system"
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Thông tin hệ thống
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ai"
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Pipeline AI / RAG</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "services"
                ? "bg-white text-blue-700 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Trạng thái dịch vụ
          </button>
        </div>
      </div>

      {/* 2. TAB 1: THÔNG TIN HỆ THỐNG */}
      {activeTab === "system" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Kiến trúc tổng thể &amp; Thông số vận hành
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Tên hệ thống:</span>
                <span className="font-bold text-slate-900">DAU Second Brain</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Đơn vị ứng dụng:</span>
                <span className="font-semibold text-slate-800">Trường Đại học Kiến trúc Đà Nẵng</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Cơ sở dữ liệu:</span>
                <span className="font-mono font-semibold text-blue-700">PostgreSQL 17 (Prisma ORM 6.19)</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Công nghệ Web:</span>
                <span className="font-semibold text-slate-800">Next.js 16 (App Router, Turbopack, React 19)</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Bộ lưu trữ file (Storage Adapter):</span>
                <span className="font-medium text-slate-800">
                  LocalStorageAdapter (Đã sẵn sàng mở rộng S3 / Cloudflare R2)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Cơ chế bảo vệ dữ liệu Publish:</span>
                <span className="font-medium text-emerald-700">
                  File Lock độc quyền + Atomic Write + Tự động Backup
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Cơ chế xác thực (Auth):</span>
                <span className="font-medium text-slate-800">
                  HMAC-SHA256 Token • Cookie HttpOnly • SameSite Lax
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Bộ xử lý nền (Background Worker):</span>
                <span className="font-medium text-blue-700">
                  Node.js Worker Loop • Tự động Stale Job Recovery • Concurrency Control
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB 2: PIPELINE AI & THỬ NGHIỆM RAG (TÍCH HỢP) */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Chạy thử nghiệm Pipeline với câu hỏi thực tế
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra trực quan quy trình trích xuất từ khóa, tìm kiếm kết hợp (Hybrid Search), ngữ cảnh trích dẫn và câu trả lời AI.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                placeholder="Nhập câu hỏi thử nghiệm..."
                className="flex-1 text-xs p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 font-medium bg-slate-50 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => handleRunPipeline()}
                disabled={loading || !testQuestion.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex-shrink-0 cursor-pointer"
              >
                {loading ? "Đang chạy Pipeline..." : "Chạy thử nghiệm RAG"}
              </button>
            </div>

            {/* Câu hỏi mẫu */}
            <div className="flex flex-wrap gap-2 pt-1 items-center">
              <span className="text-[11px] font-bold text-slate-400">Câu hỏi mẫu:</span>
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

          {/* Kết quả thử nghiệm */}
          {result && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Kết quả phân tích từ Second Brain Pipeline
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Thực thi thành công
                </span>
              </div>

              <div className="space-y-4 text-xs">
                {/* Bước 1 & 2: Tìm kiếm & Độ liên quan */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">
                      Bước 1 &amp; 2: Keyword &amp; Semantic Retrieval
                    </span>
                    <span className="font-semibold text-slate-700">
                      Tìm thấy {result.relevantDocumentsFound} đoạn văn bản liên quan
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Hybrid Fusion: 40% Keyword Match + 60% Semantic Similarity + Trọng số số hiệu công văn chính xác.
                  </p>
                </div>

                {/* Bước 3: Chunks trích dẫn */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">
                    Bước 3: Các đoạn trích dẫn được cung cấp vào Context:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.sources.map((src, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-700">{src.documentNumber || `Nguồn ${idx + 1}`}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Trang {src.page}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 line-clamp-1">{src.title}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded">
                          "{src.snippet}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bước 4: Câu trả lời tổng hợp */}
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">
                      Bước 4: Câu trả lời từ {result.modelUsed || "DAU Synthesizer"}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-100 text-slate-800 leading-relaxed whitespace-pre-wrap shadow-2xs font-normal">
                    {result.answer}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 3: TRẠNG THÁI DỊCH VỤ & BẢO MẬT */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Trạng thái các thành phần trí tuệ nhân tạo (AI Services)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Động cơ OCR:</span>
                <span className="font-semibold text-slate-800">
                  Tesseract OCR 5.5.0 (Hỗ trợ tiếng Việt: vie + eng)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Thư viện trích xuất văn bản:</span>
                <span className="font-semibold text-slate-800">
                  PyMuPDF 1.28.2 • python-docx 1.2.0 • BeautifulSoup4
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Mô hình AI tạo sinh (Generation):</span>
                <span className="font-semibold text-slate-800">
                  Google Gemini (Endpoint v1beta) • Fallback: Local Extractive Synthesizer
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Trạng thái khóa bí mật (API Key):</span>
                <span className="font-mono text-emerald-700 font-bold">
                  ✓ Bảo mật an toàn (Không hiển thị ra giao diện người dùng)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Mô hình Vector Embedding:</span>
                <span className="font-semibold text-slate-800">
                  Gemini text-embedding-004 / OpenAI text-embedding-3-small (Hỗ trợ Hybrid Search)
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Quy tắc an toàn pháp lý:</span>
                <span className="font-semibold text-slate-800">
                  Tuyệt đối không tự suy đoán thông tin khi văn bản không đề cập
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-slate-400">Đang tải cấu hình hệ thống...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
// components/ChatBox.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { SourceReference, AskResponse } from "@/types/ask";

const SAMPLE_QUESTIONS = [
  "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
  "Thủ tục phúc khảo bài thi như thế nào?",
  "Tôi cần nộp giấy chứng nhận ngoại ngữ ở đâu?",
  "Thông báo 34/TB-ĐHKTĐN nói về vấn đề gì?",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  sources?: SourceReference[];
  modelUsed?: string;
  retryQuestion?: string;
}

function friendlyModelLabel(modelUsed?: string): string {
  if (!modelUsed) return "Trợ lý trích xuất văn bản DAU";
  if (modelUsed.includes("Fallback") || modelUsed.includes("Local Extractive") || modelUsed.includes("No API Key")) {
    return "Trợ lý trích xuất văn bản DAU";
  }
  if (modelUsed.startsWith("Google Gemini")) return "Google Gemini";
  if (modelUsed.startsWith("OpenAI")) return "OpenAI";
  return "Trợ lý trích xuất văn bản DAU";
}

export default function ChatBox() {
  const [inputQuestion, setInputQuestion] = useState("");
  const [inputError, setInputError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom khi có tin nhắn mới
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || inputQuestion).trim();
    if (loading) return;

    if (!q) {
      setInputError("Vui lòng nhập câu hỏi trước khi gửi.");
      return;
    }
    setInputError("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setLoading(true);
    setLoadingStep("Đang tìm kiếm văn bản liên quan...");

    let stepTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      stepTimer = setTimeout(() => {
        setLoadingStep("Đang tổng hợp câu trả lời từ dữ liệu nhà trường...");
      }, 600);

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            "Không thể kết nối với trợ lý AI lúc này. Vui lòng thử lại sau."
        );
      }

      const data: AskResponse = await res.json();

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data.answer,
        sources: data.sources,
        modelUsed: data.modelUsed,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể kết nối với trợ lý AI lúc này. Vui lòng thử lại sau.";
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "error",
        text: message,
        retryQuestion: q,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      if (stepTimer) clearTimeout(stepTimer);
      setLoading(false);
      setLoadingStep("");
    }
  };

  // Click gợi ý → auto submit ngay
  const handleSampleClick = (question: string) => {
    handleSend(question);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[680px]">
      {/* Chat header */}
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Trợ lý văn bản DAU
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Trích dẫn trực tiếp từ kho văn bản</span>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Làm mới hội thoại
          </button>
        )}
      </div>

      {/* Chat messages viewport */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1.5">
              Bạn muốn tìm hiểu điều gì?
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Đặt câu hỏi về học phí, khảo thí, chuẩn đầu ra hoặc các thông
              báo của nhà trường. Hệ thống sẽ đối chiếu và trích dẫn văn bản
              tương ứng.
            </p>

            <div className="w-full space-y-2 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Gợi ý câu hỏi tra cứu:
              </span>
              {SAMPLE_QUESTIONS.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleSampleClick(sq)}
                  disabled={loading}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-xs font-medium text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
                >
                  <span>{sq}</span>
                  <span className="text-slate-400 group-hover:text-blue-600 text-xs">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            /* ---- Error bubble ---- */
            if (m.role === "error") {
              return (
                <div key={m.id} className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed bg-red-50 border border-red-200 rounded-bl-xs">
                    <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-red-600 opacity-80">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Lỗi hệ thống</span>
                    </div>
                    <p className="text-red-700">{m.text}</p>
                    {m.retryQuestion && (
                      <button
                        onClick={() => handleSend(m.retryQuestion)}
                        disabled={loading}
                        className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline disabled:opacity-50 cursor-pointer"
                      >
                        Thử lại →
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            /* ---- User / Assistant bubbles ---- */
            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-xs shadow-xs"
                      : "bg-slate-50 text-slate-800 rounded-bl-xs border border-slate-200"
                  }`}
                >
                  {/* Header người gửi */}
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold opacity-75">
                    <span>{m.role === "user" ? "Bạn" : "Trợ lý DAU"}</span>
                  </div>

                  {/* Nội dung tin nhắn */}
                  <div className="whitespace-pre-wrap font-sans text-sm">
                    {m.text}
                  </div>

                  {/* Label mô hình AI & xác nhận nguồn */}
                  {m.role === "assistant" && (
                    <p className="mt-2 text-[11px] text-slate-400 italic">
                      Đã đối chiếu với dữ liệu văn bản DAU
                      {m.modelUsed
                        ? ` · ${friendlyModelLabel(m.modelUsed)}`
                        : ""}
                    </p>
                  )}

                  {/* KHUNG TRÍCH DẪN NGUỒN (SOURCES / CITATION) */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5 text-xs">
                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <svg
                          className="w-3.5 h-3.5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Nguồn trích dẫn ({m.sources.length})</span>
                      </div>

                      <div className="space-y-2">
                        {m.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <Link
                                href={src.url}
                                className="font-bold text-blue-600 hover:underline line-clamp-1 text-xs"
                              >
                                [{idx + 1}] {src.title}
                              </Link>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
                                Trang {src.page}
                              </span>
                            </div>

                            <p className="text-slate-500 text-[11px] italic line-clamp-2 leading-relaxed mb-2">
                              &ldquo;{src.snippet}&rdquo;
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                              <span>
                                {src.documentNumber
                                  ? `Số: ${src.documentNumber}`
                                  : "Văn bản trường"}{" "}
                                · {src.issueDate || "2026"}
                              </span>
                              <Link
                                href={src.url}
                                className="font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
                              >
                                <span>Xem văn bản</span>
                                <span>→</span>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No-source state cho assistant */}
                  {m.role === "assistant" &&
                    (!m.sources || m.sources.length === 0) && (
                      <p className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-400">
                        Không tìm thấy văn bản nguồn phù hợp trong kho dữ liệu
                        nhà trường.
                      </p>
                    )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 rounded-bl-xs text-xs text-slate-600 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>{loadingStep || "Đang xử lý câu hỏi..."}</span>
            </div>
          </div>
        )}

        {/* Anchor để auto scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Gợi ý câu hỏi khi đã có tin nhắn */}
      {messages.length > 0 && (
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            Gợi ý:
          </span>
          {SAMPLE_QUESTIONS.slice(0, 2).map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSampleClick(q)}
              disabled={loading}
              className="text-xs text-slate-600 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 px-3 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => {
                setInputQuestion(e.target.value);
                if (e.target.value.trim()) setInputError("");
              }}
              placeholder="Nhập câu hỏi của bạn (ví dụ: Học phí học kỳ 1 năm học 2026-2027...)"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Gửi</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </div>
          {inputError && (
            <p className="text-xs text-red-500 pl-1">{inputError}</p>
          )}
        </form>
      </div>
    </div>
  );
}

// web/components/chat/ChatInterface.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Conversation, ChatMessage, AskResponse } from "@/types/ask";
import {
  loadConversations,
  saveConversations,
  generateTitleFromQuestion,
} from "@/lib/chat_storage";
import ChatSidebar from "./ChatSidebar";
import ChatMessageItem from "./ChatMessageItem";

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals state
  const [renameState, setRenameState] = useState<{ id: string; title: string } | null>(null);
  const [deleteState, setDeleteState] = useState<{ id: string; title: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Tải danh sách cuộc trò chuyện từ localStorage khi mount
  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
  }, []);

  // Cuộc trò chuyện hiện tại
  const activeConversation = conversations.find((c) => c.id === activeId) || null;
  const currentMessages = activeConversation ? activeConversation.messages : [];

  // Tự động cuộn xuống cuối tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

  // 4 Câu hỏi gợi ý ban đầu
  const sampleQuestions = [
    "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
    "Thủ tục phúc khảo bài thi như thế nào?",
    "Tôi cần nộp giấy chứng nhận ngoại ngữ ở đâu?",
    "Thông báo 34/TB-ĐHKTĐN nói về vấn đề gì?",
  ];

  // 2. Tạo cuộc trò chuyện mới
  const handleNewConversation = () => {
    setActiveId(null);
    setInputQuestion("");
    setErrorMsg(null);
  };

  // 3. Xử lý gửi câu hỏi đến API /api/ask
  const handleSend = async (questionText?: string) => {
    const text = (questionText || inputQuestion).trim();
    if (!text || loading) return;

    setErrorMsg(null);
    setInputQuestion("");
    setLoading(true);

    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: nowIso,
    };

    let targetConvId = activeId;
    let updatedConvs = [...conversations];

    // Nếu chưa có cuộc trò chuyện đang chọn -> Tạo cuộc trò chuyện mới
    if (!targetConvId) {
      targetConvId = `conv_${Date.now()}`;
      const newConv: Conversation = {
        id: targetConvId,
        title: generateTitleFromQuestion(text),
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [userMsg],
      };
      updatedConvs.unshift(newConv);
      setActiveId(targetConvId);
    } else {
      // Cập nhật câu hỏi người dùng vào cuộc trò chuyện hiện tại
      updatedConvs = updatedConvs.map((c) => {
        if (c.id === targetConvId) {
          return {
            ...c,
            updatedAt: nowIso,
            messages: [...c.messages, userMsg],
          };
        }
        return c;
      });
    }

    setConversations(updatedConvs);
    saveConversations(updatedConvs);

    // Kích hoạt API RAG thật /api/ask
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}`);
      }

      const data: AskResponse = await res.json();

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: "assistant",
        content: data.answer,
        createdAt: new Date().toISOString(),
        modelUsed: data.modelUsed || "Trợ lý AI DAU",
        citations: data.sources.map((s) => ({
          documentId: s.documentId,
          title: s.title,
          documentNumber: s.documentNumber,
          pageNumber: s.page,
          snippet: s.snippet,
          url: s.url,
        })),
      };

      // Cập nhật câu trả lời AI vào cuộc trò chuyện
      const finalConvs = updatedConvs.map((c) => {
        if (c.id === targetConvId) {
          return {
            ...c,
            updatedAt: new Date().toISOString(),
            messages: [...c.messages, assistantMsg],
          };
        }
        return c;
      });

      setConversations(finalConvs);
      saveConversations(finalConvs);
    } catch (err: any) {
      console.error("Lỗi hỏi đáp RAG:", err);
      setErrorMsg(err.message || "Không thể kết nối đến máy chủ tra cứu DAU.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Đổi tên cuộc trò chuyện
  const handleConfirmRename = () => {
    if (!renameState || !renameState.title.trim()) return;
    const updated = conversations.map((c) =>
      c.id === renameState.id ? { ...c, title: renameState.title.trim() } : c
    );
    setConversations(updated);
    saveConversations(updated);
    setRenameState(null);
  };

  // 5. Xóa cuộc trò chuyện
  const handleConfirmDelete = () => {
    if (!deleteState) return;
    const updated = conversations.filter((c) => c.id !== deleteState.id);
    setConversations(updated);
    saveConversations(updated);
    if (activeId === deleteState.id) {
      setActiveId(null);
    }
    setDeleteState(null);
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Lịch sử Chat */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
        onNewConversation={handleNewConversation}
        onRenameConversation={(id, title) => setRenameState({ id, title })}
        onDeleteConversation={(id, title) => setDeleteState({ id, title })}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Single Unified Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Mở lịch sử chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight">DAU Second Brain</span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Hỏi đáp AI
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Trang chủ
            </Link>
            <Link
              href="/documents"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Tra cứu văn bản
            </Link>
            <Link
              href="/categories"
              className="hidden sm:inline-block text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Chủ đề
            </Link>
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/admin"
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-xl shadow-xs transition-colors"
            >
              Quản trị
            </Link>
          </div>
        </header>

        {/* Chat Body */}
        <main className="flex-1 overflow-y-auto flex flex-col relative">
          {currentMessages.length === 0 ? (
            /* TRẠNG THÁI BAN ĐẦU KHÔNG CÓ TIN NHẮN (Empty State) */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-3xl mx-auto w-full text-center">
              <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-md mb-4 animate-in zoom-in-95 duration-200">
                D
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                DAU Second Brain
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
                Trợ lý hỏi đáp thông tin và văn bản Trường Đại học Kiến trúc Đà Nẵng.
              </p>

              {/* Ô Nhập Câu Hỏi Ban Đầu */}
              <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-md p-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mb-8">
                <textarea
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Bạn muốn hỏi điều gì về thông tin DAU..."
                  rows={2}
                  className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none outline-none p-1.5"
                />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 px-1">
                  <span className="text-[11px] text-slate-400 font-medium">Nhấn Enter để gửi</span>
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!inputQuestion.trim() || loading}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs rounded-xl transition-colors shadow-2xs cursor-pointer"
                  >
                    Gửi câu hỏi
                  </button>
                </div>
              </div>

              {/* 4 Câu Hỏi Gợi Ý */}
              <div className="w-full max-w-xl text-left">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3 px-1">
                  Câu hỏi gợi ý mẫu:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="p-3 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl text-left text-xs font-medium text-slate-700 hover:text-blue-700 transition-all shadow-2xs cursor-pointer group flex items-start gap-2"
                    >
                      <span className="text-blue-500 font-bold">💬</span>
                      <span className="flex-1 leading-snug">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* KHU VỰC CHAT KHI ĐÃ BẮT ĐẦU CUỘC TRÒ CHUYỆN */
            <div className="flex-1 overflow-y-auto pb-32">
              {currentMessages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} />
              ))}

              {/* Loading State Indicator */}
              {loading && (
                <div className="py-6 bg-slate-50/70 border-y border-slate-100">
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-3 sm:gap-4 items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs animate-pulse">
                      AI
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Đang truy xuất văn bản & tổng hợp câu trả lời...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error & Retry State */}
              {errorMsg && (
                <div className="max-w-3xl mx-auto my-4 px-4 sm:px-6">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === "user");
                        if (lastUserMsg) handleSend(lastUserMsg.content);
                      }}
                      className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                    >
                      Thử lại
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Ô Nhập Câu Hỏi Cố Định Ở Đáy Khi Đã Có Tin Nhắn */}
          {currentMessages.length > 0 && (
            <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 z-10">
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-300 shadow-lg p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex items-end gap-2">
                  <textarea
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Nhập câu hỏi tiếp theo..."
                    rows={1}
                    className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none outline-none p-2 max-h-32"
                  />
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!inputQuestion.trim() || loading}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-colors shadow-2xs flex-shrink-0 cursor-pointer"
                    title="Gửi câu hỏi (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mt-1.5">
                  <span>Nhấn Enter để gửi • Shift + Enter để xuống dòng</span>
                  <span>DAU Second Brain RAG Pipeline</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* RENAME MODAL */}
      {renameState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">Đổi tên cuộc trò chuyện</h3>
            <input
              type="text"
              value={renameState.title}
              onChange={(e) => setRenameState({ ...renameState, title: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-500 mb-4"
              placeholder="Nhập tiêu đề mới..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameState(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">Xóa cuộc trò chuyện?</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Nội dung cuộc trò chuyện <span className="font-bold text-slate-800">"{deleteState.title}"</span> sẽ bị xóa khỏi lịch sử của bạn.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteState(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

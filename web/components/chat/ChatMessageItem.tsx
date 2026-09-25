// web/components/chat/ChatMessageItem.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ChatMessage } from "@/types/ask";

interface ChatMessageItemProps {
  message: ChatMessage;
}

export default function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === "user";

  const getCleanModelName = (model?: string) => {
    if (!model) return "Trợ lý AI DAU";
    if (model.toLowerCase().includes("gemini")) return `Mô hình AI: ${model}`;
    if (
      model.toLowerCase().includes("synthesizer") ||
      model.toLowerCase().includes("local") ||
      model.toLowerCase().includes("fallback")
    ) {
      return "Trợ lý AI DAU (Cục bộ)";
    }
    return model;
  };

  return (
    <div className={`py-4 sm:py-6 ${isUser ? "bg-white" : "bg-slate-50/70 border-y border-slate-100"}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              SV
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header Role Label */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              {isUser ? "Bạn (Sinh viên)" : getCleanModelName(message.modelUsed)}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Body Text */}
          <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
            {message.content}
          </div>

          {/* Citations Block for AI Messages */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Nguồn trích dẫn ({message.citations.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.citations.map((cite, idx) => {
                  const targetUrl = cite.url || `/documents/${cite.documentId}#page-${cite.pageNumber || 1}`;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {cite.documentNumber || `Nguồn ${idx + 1}`}
                          </span>
                          {cite.pageNumber && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              Trang {cite.pageNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
                          {cite.title}
                        </p>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <Link
                          href={targetUrl}
                          target="_blank"
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
                        >
                          <span>Xem văn bản</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

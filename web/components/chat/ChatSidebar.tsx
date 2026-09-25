// web/components/chat/ChatSidebar.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Conversation } from "@/types/ask";
import { groupConversationsByDate } from "@/lib/chat_storage";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, currentTitle: string) => void;
  onDeleteConversation: (id: string, title: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  isOpen,
  onClose,
}: ChatSidebarProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const groups = groupConversationsByDate(conversations);

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-1 my-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block">
          {title}
        </span>
        <div className="space-y-0.5">
          {items.map((conv) => {
            const isActive = conv.id === activeId;
            const isMenuOpen = activeMenuId === conv.id;

            return (
              <div key={conv.id} className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-6">
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <span className="truncate">{conv.title}</span>
                  </div>
                </button>

                {/* Dropdown Options Button (...) */}
                <div className="absolute right-2 top-2 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : conv.id);
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isActive
                        ? "text-blue-100 hover:bg-blue-700 hover:text-white"
                        : "text-slate-400 hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100"
                    }`}
                    title="Tùy chọn cuộc trò chuyện"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>

                  {/* Dropdown Popover */}
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-slate-800 text-xs z-50 animate-in fade-in">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                          onRenameConversation(conv.id, conv.title);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Đổi tên</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                          onDeleteConversation(conv.id, conv.title);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Xóa chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const hasAnyConversation = conversations.length > 0;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Top Header: Brand & New Chat */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              D
            </div>
            <span className="font-extrabold text-white text-sm tracking-tight">DAU Second Brain</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Nút "+ Cuộc trò chuyện mới" */}
        <button
          type="button"
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Cuộc trò chuyện mới</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!hasAnyConversation ? (
          <div className="text-center py-8 px-4 text-xs text-slate-500">
            <p>Chưa có cuộc trò chuyện nào.</p>
            <p className="mt-1 text-[11px] text-slate-400">Đặt câu hỏi để bắt đầu lưu lịch sử.</p>
          </div>
        ) : (
          <>
            {renderGroup("Hôm nay", groups.today)}
            {renderGroup("Hôm qua", groups.yesterday)}
            {renderGroup("7 ngày trước", groups.last7Days)}
            {renderGroup("Cũ hơn", groups.older)}
          </>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs space-y-1">
        <Link
          href="/documents"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Kho văn bản gốc</span>
        </Link>
        <Link
          href="/admin"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
          <span>Quản trị Second Brain</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible/Fixed Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-30 shadow-md">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />
          <div className="relative w-72 max-w-[80vw] h-full z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

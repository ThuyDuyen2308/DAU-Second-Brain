// components/admin/AdminToast.tsx
"use client";

import React, { useEffect } from "react";

interface AdminToastProps {
  message: string | null;
  type?: "info" | "success" | "warning";
  onClose: () => void;
  duration?: number;
}

export default function AdminToast({
  message,
  type = "info",
  onClose,
  duration = 3500,
}: AdminToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bgStyles = {
    info: "bg-slate-900 text-white border-slate-800",
    success: "bg-emerald-900 text-white border-emerald-800",
    warning: "bg-amber-900 text-white border-amber-800",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in max-w-md">
      <div
        className={`px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 text-xs ${bgStyles[type]}`}
      >
        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="leading-relaxed font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

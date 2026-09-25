// components/admin/AdminHeader.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthUser } from "@/lib/auth/types";

interface AdminHeaderProps {
  onMenuToggle: () => void;
}

export default function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Tải thông tin session thật từ API server-side
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error("Lỗi lấy thông tin session:", err));
  }, []);

  // Derive human-friendly title from pathname
  const getPageTitle = () => {
    if (pathname === "/admin") return "Tổng quan hệ thống";
    if (pathname === "/admin/documents") return "Quản lý văn bản";
    if (pathname === "/admin/documents/new") return "Thêm văn bản mới";
    if (pathname.startsWith("/admin/documents/")) return "Chi tiết văn bản";
    if (pathname === "/admin/categories") return "Quản lý danh mục";
    if (pathname === "/admin/users") return "Quản lý tài khoản";
    if (pathname === "/admin/questions") return "Lịch sử hỏi đáp";
    if (pathname === "/admin/ai") return "AI & Kho tri thức";
    if (pathname === "/admin/settings") return "Cài đặt hệ thống";
    return "Quản trị";
  };

  const displayName = currentUser?.name || "Admin DAU";
  const displayEmail = currentUser?.email || "admin@dau.edu.vn";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "AD";

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile menu toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Mở menu quản trị"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 hidden sm:inline">Admin</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Link to public website */}
        <Link
          href="/"
          target="_blank"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 rounded-xl transition-colors border border-blue-100"
        >
          <span>Xem website</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>

        {/* Notification bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative cursor-pointer"
            aria-label="Xem thông báo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2.5 z-50 animate-in fade-in">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Thông báo hệ thống</span>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  3 tin mới
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="px-4 py-2.5 hover:bg-slate-50">
                  <p className="font-semibold text-slate-800">Xác thực Session HTTP-only</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Phiên đăng nhập Admin bảo vệ bằng HMAC server-side.</p>
                </div>
                <div className="px-4 py-2.5 hover:bg-slate-50">
                  <p className="font-semibold text-slate-800">Citation Test 7/7 PASS</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Toàn vẹn số trang và liên kết văn bản.</p>
                </div>
                <div className="px-4 py-2.5 hover:bg-slate-50">
                  <p className="font-semibold text-slate-800">Chế độ trích xuất cục bộ</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Hệ thống đang hoạt động ngoại tuyến an toàn.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin profile badge with session data */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200" title={displayEmail}>
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <span className="text-xs font-bold text-slate-800 block leading-tight">{displayName}</span>
            <span className="text-[10px] text-slate-400 block leading-tight">{displayEmail}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

// app/admin/layout.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Monkey-patch global fetch để tự động gắn Authorization Bearer header
    // cho mọi request /api/admin/* từ admin panel.
    // Điều này đảm bảo mỗi tab browser dùng token riêng từ sessionStorage,
    // không bị ảnh hưởng bởi việc đăng nhập tài khoản khác ở tab khác.
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (input, init = {}) {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const isAdminApi = url.startsWith("/api/admin") || url.includes("/api/admin");

      if (isAdminApi) {
        const token = sessionStorage.getItem("dau_session_token");
        if (token) {
          const headers: Record<string, string> = {};
          // Copy existing headers
          if (init.headers) {
            if (init.headers instanceof Headers) {
              init.headers.forEach((v, k) => { headers[k] = v; });
            } else if (Array.isArray(init.headers)) {
              init.headers.forEach(([k, v]) => { headers[k] = v; });
            } else {
              Object.assign(headers, init.headers);
            }
          }
          headers["Authorization"] = `Bearer ${token}`;
          init = { ...init, headers, credentials: "include" };
        }
      }

      return originalFetch(input, init);
    };

    // Xác minh session admin còn hợp lệ không
    const token = sessionStorage.getItem("dau_session_token");
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.authenticated || data.user?.role !== "admin") {
            sessionStorage.removeItem("dau_session_token");
            sessionStorage.removeItem("dau_session_role");
            router.replace("/login?redirect=/admin");
          } else {
            setSessionReady(true);
          }
        })
        .catch(() => setSessionReady(true)); // Lỗi mạng: cho vào và để middleware xử lý
    } else {
      // Không có token trong sessionStorage — vẫn cho vào (middleware/cookie còn xử lý)
      setSessionReady(true);
    }

    return () => {
      // Restore original fetch khi unmount
      window.fetch = originalFetch;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar (fixed desktop + drawer mobile) */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <AdminHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {sessionReady ? children : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              <span className="animate-pulse">Đang xác minh phiên làm việc...</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

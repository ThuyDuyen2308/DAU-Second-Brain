// components/Header.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AuthUser } from "@/lib/auth/types";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("dau_session_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/auth/me", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("dau_session_token");
        sessionStorage.removeItem("dau_session_role");
      }
      setCurrentUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Lỗi đăng xuất:", err);
    }
  };

  // Ẩn Header toàn cục ở trang chủ (/), trang hỏi đáp (/ask) và trang admin (/admin)
  // để tránh trùng lặp 2 Header và giữ trải nghiệm full-screen ChatGPT-like
  if (pathname === "/" || pathname === "/ask" || pathname.startsWith("/admin")) {
    return null;
  }

  const navLinks = [
    { href: "/", label: "Trang chủ" },
    { href: "/ask", label: "Hỏi đáp AI" },
    { href: "/documents", label: "Tra cứu văn bản" },
    { href: "/categories", label: "Chủ đề" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo bên trái */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm group-hover:bg-blue-700 transition-colors">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">
                  DAU
                </span>
                <span className="font-semibold text-base text-blue-600 tracking-tight leading-none">
                  Second Brain
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                Trợ lý tra cứu văn bản nhà trường
              </span>
            </div>
          </Link>

          {/* Navigation links - Desktop */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "text-blue-600 bg-blue-50 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth Actions - Right */}
          <div className="hidden md:flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="truncate max-w-[130px]">{currentUser.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${currentUser.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                    {currentUser.role === "admin" ? "Admin" : "SV"}
                  </span>
                </div>
                {currentUser.role === "admin" && (
                  <Link
                    href="/admin"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    Quản trị
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/ask"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Hỏi đáp AI
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {currentUser ? (
                <div className="space-y-2">
                  <div className="px-3 py-1.5 text-xs text-slate-700 font-medium">
                    Đăng nhập bởi: <span className="font-bold">{currentUser.name}</span> ({currentUser.role})
                  </div>
                  {currentUser.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full text-center px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
                    >
                      Khu vực Quản trị
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-center px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl"
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/ask"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
                  >
                    Hỏi đáp AI
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

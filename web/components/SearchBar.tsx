// components/SearchBar.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  initialQuery = "",
  placeholder = "Bạn muốn tìm văn bản hoặc thông tin gì?",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/documents?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/documents");
    }
  };

  return (
    <form onSubmit={handleSearch} className={`w-full ${className}`}>
      <div className="relative flex items-center shadow-sm rounded-2xl overflow-hidden bg-white border border-slate-300 hover:border-slate-400 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
        <div className="pl-4.5 sm:pl-5 text-slate-400 flex items-center pointer-events-none">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-3.5 sm:py-4 text-slate-900 placeholder-slate-400 focus:outline-none text-sm sm:text-base bg-transparent font-normal"
        />
        <div className="pr-2 sm:pr-2.5 flex items-center">
          <button
            type="submit"
            className="px-5 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm whitespace-nowrap cursor-pointer"
          >
            Tìm kiếm
          </button>
        </div>
      </div>
    </form>
  );
}

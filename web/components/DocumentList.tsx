// components/DocumentList.tsx
"use client";

import { useState } from "react";
import { Document } from "@/types/document";
import DocumentCard from "./DocumentCard";

interface DocumentListProps {
  initialDocuments: Document[];
  categories: string[];
  initialQuery?: string;
  initialCategory?: string;
}

export default function DocumentList({
  initialDocuments,
  categories,
  initialQuery = "",
  initialCategory = "all",
}: DocumentListProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const filteredDocs = initialDocuments.filter((doc) => {
    // 1. Text Query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchNum = doc.document_number
        ? doc.document_number.toLowerCase().includes(q)
        : false;
      const matchContent = doc.content ? doc.content.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchNum && !matchContent) return false;
    }

    // 2. Category
    if (selectedCategory !== "all" && doc.category !== selectedCategory) {
      return false;
    }

    // 3. Status
    if (selectedStatus !== "all" && doc.effective_status !== selectedStatus) {
      return false;
    }

    // 4. Year
    if (selectedYear !== "all") {
      if (!doc.issue_date || !doc.issue_date.startsWith(selectedYear)) {
        return false;
      }
    }

    return true;
  });

  const handleResetFilters = () => {
    setQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedYear("all");
  };

  const hasActiveFilters =
    query.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedStatus !== "all" ||
    selectedYear !== "all";

  return (
    <div>
      {/* Search & Mobile Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề, số hiệu, nội dung văn bản..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nút bật bộ lọc trên mobile */}
        <button
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Bộ lọc</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          )}
        </button>
      </div>

      {/* Layout 2 cột: Trái là Sidebar Filter (desktop), Phải là Danh sách */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filter Sidebar - Desktop & Mobile Drawer */}
        <div
          className={`lg:block ${
            mobileFilterOpen ? "block" : "hidden"
          } lg:col-span-1`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                  Bộ lọc văn bản
                </h3>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Xóa lọc
                </button>
              )}
            </div>

            {/* Bộ lọc Chủ đề */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Chủ đề văn bản
              </label>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    selectedCategory === "all"
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Tất cả chủ đề ({initialDocuments.length})
                </button>
                {categories.map((cat) => {
                  const cnt = initialDocuments.filter((d) => d.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                        selectedCategory === cat
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bộ lọc Trạng thái hiệu lực */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Trạng thái hiệu lực
              </label>
              <div className="space-y-1">
                {[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "unknown", label: "Chưa xác định hiệu lực" },
                  { value: "effective", label: "Còn hiệu lực" },
                  { value: "expired", label: "Hết hiệu lực" },
                ].map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setSelectedStatus(st.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      selectedStatus === st.value
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bộ lọc Năm ban hành */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Năm ban hành
              </label>
              <div className="space-y-1">
                {[
                  { value: "all", label: "Tất cả các năm" },
                  { value: "2026", label: "Năm 2026" },
                  { value: "2025", label: "Năm 2025" },
                ].map((yr) => (
                  <button
                    key={yr.value}
                    onClick={() => setSelectedYear(yr.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      selectedYear === yr.value
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {yr.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Danh sách văn bản - 3 cột desktop */}
        <div className="lg:col-span-3">
          {/* Thanh đếm kết quả */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hiển thị <span className="font-bold text-blue-600">{filteredDocs.length}</span> văn bản
            </span>
            {hasActiveFilters && (
              <span className="text-xs text-slate-500">
                Đang áp dụng bộ lọc tùy chỉnh
              </span>
            )}
          </div>

          {filteredDocs.length > 0 ? (
            <div className="space-y-4">
              {filteredDocs.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-base text-slate-800 mb-1">
                Không tìm thấy văn bản phù hợp
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                Vui lòng thử điều chỉnh lại từ khóa hoặc xóa bớt các tiêu chí lọc đã chọn.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Xóa bộ lọc & Xem tất cả
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

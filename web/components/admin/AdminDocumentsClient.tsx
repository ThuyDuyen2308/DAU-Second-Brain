// components/admin/AdminDocumentsClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminToast from "@/components/admin/AdminToast";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import { Document } from "@/types/document";

interface AdminDocumentsClientProps {
  documents: Document[];
}

export default function AdminDocumentsClient({ documents }: AdminDocumentsClientProps) {
  const initialDocs = useMemo(() => {
    return documents.map((d) => ({
      id: d.id,
      title: d.title,
      documentNumber: d.document_number,
      issueDate: d.issue_date,
      category: d.category || "Chưa phân loại",
      totalPages: d.total_pages || (d.pages ? d.pages.length : 1),
      chunkCount: Math.ceil((d.content?.length || 500) / 450) || 2,
      processingStatus: "processed" as "processed" | "unprocessed",
      effectiveStatus: d.effective_status || "unknown",
    }));
  }, [documents]);

  const [docsList, setDocsList] = useState(initialDocs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lọc theo search, category, processing status
  const filteredDocs = useMemo(() => {
    return docsList.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.documentNumber && doc.documentNumber.toLowerCase().includes(q)) ||
        (doc.issueDate && doc.issueDate.toLowerCase().includes(q));

      const matchCategory = selectedCategory === "all" || doc.category === selectedCategory;
      const matchStatus =
        selectedStatus === "all" ||
        (selectedStatus === "processed" && doc.processingStatus === "processed") ||
        (selectedStatus === "unprocessed" && doc.processingStatus === "unprocessed");

      return matchQuery && matchCategory && matchStatus;
    });
  }, [docsList, searchQuery, selectedCategory, selectedStatus]);

  // Categories duy nhất
  const categories = useMemo(() => {
    const set = new Set(initialDocs.map((d) => d.category));
    return Array.from(set);
  }, [initialDocs]);

  // Handler xóa demo
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDocsList((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
    setToastMessage("Đây là thao tác demo. Dữ liệu nguồn hiện tại chưa được kết nối database.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản lý văn bản
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Quản lý kho văn bản được sử dụng làm nguồn tri thức cho hệ thống hỏi đáp.
          </p>
        </div>

        <Link
          href="/admin/documents/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span>Thêm văn bản</span>
        </Link>
      </div>

      {/* 2. Thanh tìm kiếm & Bộ lọc (Filter Bar) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Ô tìm kiếm */}
          <div className="sm:col-span-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, số hiệu, ngày..."
              className="w-full px-3.5 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Lọc danh mục */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc trạng thái xử lý */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả trạng thái xử lý</option>
              <option value="processed">Đã xử lý OCR ({initialDocs.length})</option>
              <option value="unprocessed">Chưa xử lý (0)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>
            Tìm thấy <strong className="text-slate-700">{filteredDocs.length}</strong> văn bản
          </span>
          {(searchQuery || selectedCategory !== "all" || selectedStatus !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedStatus("all");
              }}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* 3. Bảng dữ liệu Desktop (Table) */}
      {filteredDocs.length === 0 ? (
        <AdminEmptyState
          title="Không tìm thấy văn bản phù hợp"
          description="Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các điều kiện lọc để xem kết quả."
          actionLabel="Xóa bộ lọc"
          onAction={() => {
            setSearchQuery("");
            setSelectedCategory("all");
            setSelectedStatus("all");
          }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-3.5 px-4">Văn bản</th>
                    <th className="py-3.5 px-3">Số hiệu</th>
                    <th className="py-3.5 px-3">Ngày</th>
                    <th className="py-3.5 px-3">Danh mục</th>
                    <th className="py-3.5 px-3 text-center">Trang</th>
                    <th className="py-3.5 px-3 text-center">Chunks</th>
                    <th className="py-3.5 px-3">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          href={`/admin/documents/${doc.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors line-clamp-2"
                        >
                          {doc.title}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {doc.id}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {doc.documentNumber || <span className="text-slate-400 italic">Chưa có</span>}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {doc.issueDate || <span className="text-slate-400 italic">Chưa rõ</span>}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {doc.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                        {doc.totalPages}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-slate-500">
                        {doc.chunkCount}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Đã xử lý
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/admin/documents/${doc.id}`}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/admin/documents/${doc.id}`}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa thông tin"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa văn bản (Demo)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (Responsive) */}
          <div className="md:hidden space-y-3">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {doc.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Đã xử lý
                  </span>
                </div>

                <Link
                  href={`/admin/documents/${doc.id}`}
                  className="font-bold text-slate-900 hover:text-blue-600 text-xs block leading-snug"
                >
                  {doc.title}
                </Link>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-100">
                  <div>Số: {doc.documentNumber || "Chưa có"}</div>
                  <div>Ngày: {doc.issueDate || "Chưa rõ"}</div>
                  <div>Quy mô: {doc.totalPages} trang</div>
                  <div>Chunks: {doc.chunkCount} đoạn</div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                  <Link
                    href={`/admin/documents/${doc.id}`}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium"
                  >
                    Xem
                  </Link>
                  <Link
                    href={`/admin/documents/${doc.id}`}
                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium"
                  >
                    Sửa
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                    className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. Modal xác nhận xóa văn bản */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xóa văn bản khỏi danh sách?"
        message={`Bạn có chắc chắn muốn xóa văn bản "${deleteTarget?.title}"? Thao tác này là thao tác demo trên giao diện.`}
        confirmLabel="Xóa văn bản"
        cancelLabel="Hủy"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 5. Toast thông báo */}
      <AdminToast
        message={toastMessage}
        type="info"
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}

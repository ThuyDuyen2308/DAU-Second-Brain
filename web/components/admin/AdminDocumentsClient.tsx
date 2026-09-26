// components/admin/AdminDocumentsClient.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminToast from "@/components/admin/AdminToast";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import StatusBadge from "@/components/StatusBadge";
import { Document, CategoryStats } from "@/types/document";

interface AdminDocumentsClientProps {
  documents: Document[];
  categoryStats?: CategoryStats[];
}

export default function AdminDocumentsClient({
  documents,
  categoryStats = [],
}: AdminDocumentsClientProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "categories" ? "categories" : "documents";
  const statusParam = searchParams.get("status") || "all";

  const [activeTab, setActiveMainTab] = useState<"documents" | "categories">(initialTab);

  // Danh sách tài liệu quản lý
  const [docsList, setDocsList] = useState(documents);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedEffectiveStatus, setSelectedEffectiveStatus] = useState(statusParam);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal xác minh tình trạng hiệu lực
  const [editingValidityDoc, setEditingValidityDoc] = useState<Document | null>(null);
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editDeadline, setEditDeadline] = useState<string>("");
  const [editEffectiveFrom, setEditEffectiveFrom] = useState<string>("");
  const [editEffectiveTo, setEditEffectiveTo] = useState<string>("");
  const [editReplacedBy, setEditReplacedBy] = useState<string>("");
  const [editStatusEvidence, setEditStatusEvidence] = useState<string>("");
  const [editVerificationNote, setEditVerificationNote] = useState<string>("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Quản lý danh mục
  const [customCategories, setCustomCategories] = useState<CategoryStats[]>(categoryStats);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    if (searchParams.get("tab") === "categories") {
      setActiveMainTab("categories");
    }
    const st = searchParams.get("status");
    if (st) {
      setSelectedEffectiveStatus(st);
    }
  }, [searchParams]);

  // Danh sách danh mục duy nhất cho bộ lọc
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set);
  }, [documents]);

  // Lọc văn bản theo search, category, effectiveStatus
  const filteredDocs = useMemo(() => {
    return docsList.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.document_number && doc.document_number.toLowerCase().includes(q)) ||
        (doc.issue_date && doc.issue_date.toLowerCase().includes(q)) ||
        (doc.content && doc.content.toLowerCase().includes(q));

      const matchCategory = selectedCategory === "all" || doc.category === selectedCategory;

      let matchEffective = true;
      if (selectedEffectiveStatus !== "all") {
        if (selectedEffectiveStatus === "unverified") {
          matchEffective =
            doc.effective_status === "unverified" ||
            doc.effective_status === "unknown" ||
            !doc.effective_status;
        } else {
          matchEffective = doc.effective_status === selectedEffectiveStatus;
        }
      }

      return matchQuery && matchCategory && matchEffective;
    });
  }, [docsList, searchQuery, selectedCategory, selectedEffectiveStatus]);

  // Mở modal xác minh
  const openValidityModal = (doc: Document) => {
    setEditingValidityDoc(doc);
    setEditStatus(doc.effective_status || "unverified");
    setEditDeadline(doc.deadline || "");
    setEditEffectiveFrom(doc.effective_from || "");
    setEditEffectiveTo(doc.effective_to || "");
    setEditReplacedBy(doc.replaced_by || "");
    setEditStatusEvidence(doc.status_evidence || "");
    setEditVerificationNote("");
  };

  // Lưu trạng thái và xác minh
  const handleSaveValidity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingValidityDoc) return;
    setIsSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/documents/${editingValidityDoc.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effective_status: editStatus,
          deadline: editDeadline.trim() || null,
          effective_from: editEffectiveFrom.trim() || null,
          effective_to: editEffectiveTo.trim() || null,
          replaced_by: editReplacedBy.trim() || null,
          status_evidence: editStatusEvidence.trim() || null,
          verification_note: editVerificationNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể cập nhật tình trạng hiệu lực");
      }

      setDocsList((prev) =>
        prev.map((d) => (d.id === editingValidityDoc.id ? data.document : d))
      );
      setToastMessage(
        `Đã xác minh và cập nhật tình trạng cho "${editingValidityDoc.title}".`
      );
      setEditingValidityDoc(null);
    } catch (err: any) {
      setToastMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Xóa văn bản (demo / local state)
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setDocsList((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteTarget(null);
    setToastMessage(`Đã xóa văn bản "${deleteTarget.title}" khỏi giao diện.`);
  };

  // Thêm danh mục mới
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (customCategories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      setToastMessage("Danh mục này đã tồn tại trong danh sách.");
      return;
    }

    setCustomCategories((prev) => [
      ...prev,
      { name: newCatName.trim(), count: 0, subcategories: [] },
    ]);
    setNewCatName("");
    setShowAddCatModal(false);
    setToastMessage(`Đã tạo danh mục mới "${newCatName.trim()}".`);
  };

  const selectCategoryAndFilter = (catName: string) => {
    setSelectedCategory(catName);
    setActiveMainTab("documents");
  };

  const totalPages = documents.reduce((acc, d) => acc + (d.total_pages || 1), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Trang & Tab chuyển đổi Kho văn bản / Danh mục */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản lý tài liệu &amp; Danh mục tri thức
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Tra cứu văn bản số hóa, phân loại chủ đề và xem chi tiết các đoạn trích dẫn RAG.
          </p>
        </div>

        {/* Nút chuyển đổi Tab & Nút thêm */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveMainTab("documents")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "documents"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Kho văn bản ({docsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab("categories")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "categories"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Danh mục ({customCategories.length})</span>
            </button>
          </div>

          <Link
            href="/admin/import"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Nhập tài liệu mới</span>
          </Link>
        </div>
      </div>

      {/* 2. NỘI DUNG TAB 1: KHO VĂN BẢN */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Thanh tìm kiếm & Bộ lọc */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              {/* Ô tìm kiếm */}
              <div className="sm:col-span-6 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên văn bản, số hiệu (vd: 34/TB, 607/QĐ)..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Lọc danh mục */}
              <div className="sm:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tất cả danh mục ({uniqueCategories.length})</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc hiệu lực */}
              <div className="sm:col-span-3">
                <select
                  value={selectedEffectiveStatus}
                  onChange={(e) => setSelectedEffectiveStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="all">Tất cả trạng thái hiệu lực</option>
                  <option value="active">🟢 Còn hiệu lực</option>
                  <option value="deadline_passed">🔵 Hết thời hạn thực hiện</option>
                  <option value="expired">🔴 Hết hiệu lực</option>
                  <option value="replaced">⚪ Đã bị thay thế</option>
                  <option value="unverified">🟡 Chưa xác minh</option>
                </select>
              </div>
            </div>

            {/* Thông tin số lượng kết quả */}
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
              <span>
                Hiển thị <strong>{filteredDocs.length}</strong> / {docsList.length} văn bản • Tổng số trang: <strong>{totalPages}</strong>
              </span>
              {(searchQuery || selectedCategory !== "all" || selectedEffectiveStatus !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedEffectiveStatus("all");
                  }}
                  className="text-blue-600 hover:underline cursor-pointer font-semibold"
                >
                  Xóa tất cả bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Bảng danh sách văn bản */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredDocs.length === 0 ? (
              <AdminEmptyState
                title="Không tìm thấy văn bản phù hợp"
                description="Thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại bộ lọc danh mục và hiệu lực."
                actionLabel="Xóa bộ lọc"
                onAction={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedEffectiveStatus("all");
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tên văn bản &amp; Số hiệu</th>
                      <th className="py-3 px-3">Danh mục</th>
                      <th className="py-3 px-3">Ngày ban hành</th>
                      <th className="py-3 px-3">Tình trạng hiệu lực</th>
                      <th className="py-3 px-3">Hạn / Hiệu lực</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 max-w-sm sm:max-w-md">
                          <Link
                            href={`/admin/documents/${doc.id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 block line-clamp-2 leading-snug"
                          >
                            {doc.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                            <span className="font-semibold text-slate-700">
                              {doc.document_number || "Không có số hiệu"}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">ID: {doc.id}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                            {doc.category || "Chưa phân loại"}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {doc.issue_date || "—"}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <StatusBadge
                            status={doc.effective_status}
                            isVerified={doc.is_verified}
                          />
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {doc.deadline ? (
                            <span className="font-mono text-indigo-700 font-semibold" title="Hạn thực hiện">
                              Hạn: {doc.deadline}
                            </span>
                          ) : doc.effective_from ? (
                            <span className="font-mono text-emerald-700 font-semibold" title="Ngày có hiệu lực">
                              Từ: {doc.effective_from}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => openValidityModal(doc)}
                            className="px-2.5 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold rounded-lg transition-colors inline-block cursor-pointer text-[11px]"
                            title="Xác minh hoặc điều chỉnh tình trạng hiệu lực"
                          >
                            ⚙️ Xác minh
                          </button>
                          <Link
                            href={`/admin/documents/${doc.id}`}
                            className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 font-bold rounded-lg transition-colors inline-block text-[11px]"
                          >
                            Chi tiết →
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Xóa văn bản"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. NỘI DUNG TAB 2: DANH MỤC TRI THỨC (TÍCH HỢP) */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Danh mục tri thức đã chuẩn hóa ({customCategories.length} nhóm)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhấp vào danh mục bất kỳ để lọc nhanh danh sách các văn bản thuộc nhóm đó.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCatModal(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              + Thêm danh mục
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customCategories.map((cat) => (
              <div
                key={cat.name}
                onClick={() => selectCategoryAndFilter(cat.name)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer space-y-3 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                      {cat.name}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {cat.count} văn bản
                    </span>
                  </div>

                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Phân nhóm:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.subcategories.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Chưa có phân nhóm</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold">
                  <span>Xem các văn bản →</span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Xác Minh & Hiệu Chỉnh Tình Trạng Hiệu Lực */}
      {editingValidityDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Admin Verification &amp; Audit
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-snug">
                  Xác minh tình trạng hiệu lực văn bản
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium line-clamp-1">
                  {editingValidityDoc.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingValidityDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Khối căn cứ AI / Pipeline trích xuất tự động */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">
                  🔍 Căn cứ trích xuất từ văn bản nguồn:
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Độ tin cậy: {editingValidityDoc.certainty || "MEDIUM"}
                </span>
              </div>
              <p className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 italic font-mono text-[11px]">
                {editingValidityDoc.status_evidence || "Chưa tìm thấy điều khoản hiệu lực rõ ràng trong nội dung."}
              </p>
              {editingValidityDoc.status_rationale && (
                <p className="text-[11px] text-slate-600">
                  <strong>Phân tích:</strong> {editingValidityDoc.status_rationale}
                </p>
              )}
            </div>

            {/* Form chỉnh sửa của Admin */}
            <form onSubmit={handleSaveValidity} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Trạng thái hiệu lực */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Trạng thái hiệu lực <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">🟢 Còn hiệu lực (Active)</option>
                    <option value="deadline_passed">🔵 Hết thời hạn thực hiện (Deadline Passed)</option>
                    <option value="expired">🔴 Hết hiệu lực (Expired)</option>
                    <option value="replaced">⚪ Đã bị thay thế (Replaced)</option>
                    <option value="unverified">🟡 Chưa xác minh (Unverified)</option>
                  </select>
                </div>

                {/* Hạn thực hiện (Deadline) */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Hạn thực hiện thông báo (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    placeholder="VD: 2026-09-17"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ngày bắt đầu hiệu lực */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ngày bắt đầu có hiệu lực (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    value={editEffectiveFrom}
                    onChange={(e) => setEditEffectiveFrom(e.target.value)}
                    placeholder="VD: 2026-08-03"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ngày hết hiệu lực */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Ngày hết hiệu lực (YYYY-MM-DD)
                  </label>
                  <input
                    type="text"
                    value={editEffectiveTo}
                    onChange={(e) => setEditEffectiveTo(e.target.value)}
                    placeholder="VD: 2027-12-31"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Văn bản thay thế nếu có */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Số hiệu / ID văn bản thay thế (nếu có)
                </label>
                <input
                  type="text"
                  value={editReplacedBy}
                  onChange={(e) => setEditReplacedBy(e.target.value)}
                  placeholder="VD: Quyết định 123/QĐ-ĐHKTĐN ngày 10/01/2027"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Căn cứ xác định trạng thái */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Căn cứ xác định trạng thái (Trích đoạn hoặc lý do)
                </label>
                <textarea
                  value={editStatusEvidence}
                  onChange={(e) => setEditStatusEvidence(e.target.value)}
                  rows={2}
                  placeholder="Trích dẫn câu văn nguồn làm căn cứ pháp lý..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Ghi chú xác minh của Admin */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Ghi chú xác minh kiểm toán của Admin
                </label>
                <input
                  type="text"
                  value={editVerificationNote}
                  onChange={(e) => setEditVerificationNote(e.target.value)}
                  placeholder="VD: Đã đối chiếu với văn bản gốc ban hành bởi Phòng Đào tạo."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Lịch sử kiểm toán (Audit Trail) */}
              {editingValidityDoc.status_history && editingValidityDoc.status_history.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-600 block mb-1.5">
                    📜 Lịch sử kiểm toán thay đổi:
                  </span>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto font-mono text-[10px] text-slate-600">
                    {editingValidityDoc.status_history.map((h, hIdx) => (
                      <div key={hIdx} className="p-1.5 bg-slate-100 rounded-lg">
                        <strong>{h.changed_at.slice(0, 19).replace("T", " ")}</strong> • Bởi:{" "}
                        <span className="text-blue-700">{h.changed_by}</span> • {h.previous_status} ➔{" "}
                        <span className="font-bold text-slate-900">{h.new_status}</span>
                        {h.note && <span className="block text-slate-500">Ghi chú: {h.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nút thao tác */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingValidityDoc(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingStatus}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingStatus ? "Đang lưu..." : "✓ Xác nhận & Lưu hiệu lực"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm Danh Mục Mới */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-slate-900">Thêm danh mục mới</h4>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ví dụ: Công tác sinh viên"
                  autoFocus
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Lưu danh mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xác nhận xóa văn bản?"
        message={`Bạn có chắc muốn xóa văn bản "${deleteTarget?.title}"?`}
        confirmLabel="Xóa văn bản"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast Notification */}
      <AdminToast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
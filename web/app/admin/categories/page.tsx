// app/admin/categories/page.tsx
"use client";

import React, { useState } from "react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import AdminToast from "@/components/admin/AdminToast";

interface CategoryState {
  name: string;
  count: number;
  subcategories: string[];
}

const INITIAL_CATEGORIES: CategoryState[] = [
  { name: "Học phí", count: 2, subcategories: ["Bảo hiểm y tế", "Học lại / cải thiện"] },
  { name: "Khảo thí", count: 4, subcategories: ["Phúc khảo đợt 1", "Phúc khảo đợt 2", "Phúc khảo đợt 3"] },
  { name: "Chuẩn đầu ra", count: 2, subcategories: ["Ngoại ngữ", "Tin học", "Quy đổi tương đương"] },
  { name: "Khảo sát", count: 2, subcategories: ["Toán học 2026", "Sự hài lòng sinh viên"] },
  { name: "Đào tạo", count: 0, subcategories: ["Quy chế đào tạo tín chỉ"] },
  { name: "Sinh viên", count: 0, subcategories: ["Chế độ chính sách", "Khen thưởng"] },
  { name: "Khác", count: 0, subcategories: [] },
];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryState[]>(INITIAL_CATEGORIES);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    if (categories.some((c) => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      setToastMessage("Danh mục này đã tồn tại.");
      return;
    }

    setCategories((prev) => [
      ...prev,
      { name: newCatName.trim(), count: 0, subcategories: [] },
    ]);
    setNewCatName("");
    setShowAddModal(false);
    setToastMessage("Đã thêm danh mục mới trên giao diện demo.");
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setCategories((prev) => prev.filter((c) => c.name !== deleteTarget));
    setDeleteTarget(null);
    setToastMessage("Đã xóa danh mục trên giao diện demo. Database chưa kết nối.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Quản lý danh mục
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Phân loại chủ đề cho kho văn bản số hóa nhà trường.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span>Thêm danh mục</span>
        </button>
      </div>

      {/* 2. Disclaimer */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Đây là thao tác trên giao diện demo. Khi bổ sung hoặc sửa danh mục, hệ thống phản hồi trực quan trên local state.
        </span>
      </div>

      {/* 3. Grid danh mục */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.name}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-bold text-slate-900 text-sm">{cat.name}</h4>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {cat.count} văn bản
                </span>
              </div>

              {cat.subcategories.length > 0 ? (
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setToastMessage("Chức năng chỉnh sửa danh mục demo.")}
                className="px-2.5 py-1 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(cat.name)}
                className="px-2.5 py-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Modal thêm danh mục */}
      {showAddModal && (
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
                  placeholder="Ví dụ: Khen thưởng sinh viên"
                  autoFocus
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Dialog */}
      <AdminConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Xóa danh mục?"
        message={`Bạn có chắc muốn xóa danh mục "${deleteTarget}"? Thao tác này là thao tác demo.`}
        confirmLabel="Xóa danh mục"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 6. Toast */}
      <AdminToast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}

// app/admin/documents/new/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminToast from "@/components/admin/AdminToast";

export default function AdminNewDocumentPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [category, setCategory] = useState("Học phí");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titleError, setTitleError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError("Vui lòng nhập tên văn bản.");
      return;
    }
    setTitleError("");
    setIsSubmitting(true);

    // Giả lập lưu demo
    setTimeout(() => {
      setIsSubmitting(false);
      setToastMessage(
        "Đã ghi nhận biểu mẫu demo. Chức năng lưu trữ máy chủ cần kết nối backend database."
      );
      setTimeout(() => {
        router.push("/admin/documents");
      }, 1500);
    }, 600);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin/documents" className="hover:text-blue-600">
              Quản lý văn bản
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Thêm mới</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Thêm văn bản mới
          </h2>
        </div>

        <Link
          href="/admin/documents"
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          ← Quay lại
        </Link>
      </div>

      {/* 2. Notice Disclaimer */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-800 flex items-start gap-2.5">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-bold">Giao diện thêm văn bản (Prototype Demo)</p>
          <p className="mt-0.5 text-blue-700 leading-relaxed">
            Hệ thống hiện tại đọc kho văn bản từ tệp chuẩn hóa nội bộ. Biểu mẫu này dùng để minh họa luồng tiếp nhận văn bản mới trước khi đưa vào pipeline OCR và Chunking.
          </p>
        </div>
      </div>

      {/* 3. Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
        {/* Tên văn bản */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Tên văn bản <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) setTitleError("");
            }}
            placeholder="Ví dụ: Thông báo về việc nộp học phí học kỳ II năm học 2026-2027..."
            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${
              titleError ? "border-red-400 ring-1 ring-red-400" : "border-slate-300"
            }`}
          />
          {titleError && <p className="text-xs text-red-500 mt-1">{titleError}</p>}
        </div>

        {/* Số hiệu & Ngày ban hành */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Số hiệu văn bản
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Ví dụ: 34/TB-ĐHKTĐN"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ngày ban hành
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Danh mục */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Danh mục chủ đề
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Học phí">Học phí</option>
            <option value="Khảo thí">Khảo thí & Đảm bảo chất lượng</option>
            <option value="Chuẩn đầu ra">Chuẩn đầu ra (Ngoại ngữ, Tin học)</option>
            <option value="Khảo sát">Khảo sát ý kiến sinh viên</option>
            <option value="Đào tạo">Quy chế đào tạo</option>
            <option value="Khác">Khác</option>
          </select>
        </div>

        {/* Mô tả tóm tắt */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Mô tả tóm tắt
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tóm tắt ngắn gọn nội dung văn bản..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Tệp văn bản (File Upload UI) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Tệp văn bản đính kèm
          </label>
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/30 transition-all cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-700">
                Kéo thả file vào đây hoặc <span className="text-blue-600 underline">chọn file từ máy tính</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Hỗ trợ định dạng: PDF, DOC, DOCX (Tối đa 25MB)
              </p>
            </div>
          </div>

          {/* Hiển thị file đã chọn */}
          {selectedFile && (
            <div className="mt-3 p-3 bg-slate-100 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{selectedFile.name}</span>
                <span className="text-slate-400">({Math.round(selectedFile.size / 1024)} KB)</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Đã chọn file (Demo)
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            href="/admin/documents"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Đang xử lý..." : "Lưu văn bản"}
          </button>
        </div>
      </form>

      {/* Toast */}
      <AdminToast
        message={toastMessage}
        type="info"
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}

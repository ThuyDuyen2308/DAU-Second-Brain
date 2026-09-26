// web/app/admin/page.tsx
import React from "react";
import Link from "next/link";
import { getAllDocuments, getRecentDocuments, getEffectiveStatusStats } from "@/lib/documents";
import { createChunksFromDocuments } from "@/lib/ai/chunking";
import { prisma } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tổng quan quản trị | DAU Second Brain",
  description: "Trang tổng quan nghiệp vụ quản trị kho văn bản và tri thức DAU Second Brain",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const allDocs = getAllDocuments();
  const recentDocs = getRecentDocuments(5);
  const statusStats = getEffectiveStatusStats();

  const totalDocuments = allDocs.length;
  const totalChunks = createChunksFromDocuments(allDocs).length;
  const totalPages = allDocs.reduce((acc, d) => acc + (d.total_pages || 0), 0);

  // Truy vấn số liệu thực tế từ cơ sở dữ liệu PostgreSQL
  let pendingCount = 0;
  let processingCount = 0;
  let processedCount = 0;
  let failedCount = 0;
  let recentImports: any[] = [];

  try {
    const [pending, processing, processed, failed, imports] = await Promise.all([
      prisma.importedDocument.count({ where: { status: "PENDING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSED" } }),
      prisma.importedDocument.count({ where: { status: "FAILED" } }),
      prisma.importedDocument.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalName: true,
          fileFormat: true,
          sizeBytes: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    pendingCount = pending;
    processingCount = processing;
    processedCount = processed;
    failedCount = failed;
    recentImports = imports;
  } catch (dbErr) {
    console.warn("[AdminDashboard] Không thể truy vấn bảng imported_documents:", dbErr);
  }

  const getImportBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">Chờ xử lý</span>;
      case "PROCESSING":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">Đang bóc tách</span>;
      case "PROCESSED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">Chờ duyệt</span>;
      case "PUBLISHED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">Đã công bố</span>;
      case "FAILED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-800">Thất bại</span>;
      case "DUPLICATE":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800">File trùng</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-7">
      {/* 1. Header Trang & Thao tác nhanh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Tổng quan kho tri thức
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Quản trị kho tài liệu số hóa, kiểm soát tiến độ bóc tách và giám sát hiệu quả RAG.
          </p>
        </div>

        {/* Nút thao tác nhanh Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Nhập tài liệu</span>
          </Link>

          <Link
            href="/admin/documents"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Quản lý tài liệu</span>
          </Link>

          <Link
            href="/admin/settings?tab=ai"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Kiểm tra AI</span>
          </Link>
        </div>
      </div>

      {/* 2. 4 Thẻ KPI nghiệp vụ thực tế */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Đã công bố */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Văn bản công bố
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalDocuments}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Đang phục vụ tra cứu RAG ({totalPages} trang)
          </p>
        </div>

        {/* KPI 2: Chờ duyệt */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tài liệu chờ duyệt
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">
            {processedCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Đã bóc tách, chờ Admin Publish ({pendingCount + processingCount} đang xử lý)
          </p>
        </div>

        {/* KPI 3: Lỗi bóc tách */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Xử lý thất bại
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-600 mt-2">
            {failedCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cần kiểm tra định dạng hoặc thử lại
          </p>
        </div>

        {/* KPI 4: Chunks RAG */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Chunks RAG
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
            {totalChunks}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Đoạn ngữ cảnh đang được trích xuất
          </p>
        </div>
      </div>

      {/* 2.5. Phân bổ Tình trạng Hiệu lực Pháp lý (5 Trạng Thái Chuẩn) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>⚖️ Tình trạng hiệu lực văn bản trong kho</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Phân loại nghiêm ngặt theo căn cứ văn bản, hạn thực hiện và kiểm toán Admin
            </p>
          </div>
          <Link
            href="/admin/documents"
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            Quản lý &amp; Xác minh ({totalDocuments}) →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-xs">
          {/* 1. Còn hiệu lực */}
          <Link
            href="/admin/documents?status=active"
            className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 hover:bg-emerald-100/70 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 text-[11px]">Còn hiệu lực</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-xl font-black text-emerald-900 mt-2">
              {statusStats.active || 0}
            </div>
            <span className="text-[10px] text-emerald-700/80 mt-1">Đang áp dụng</span>
          </Link>

          {/* 2. Hết thời hạn thực hiện */}
          <Link
            href="/admin/documents?status=deadline_passed"
            className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/70 hover:bg-indigo-100/70 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-800 text-[11px]">Hết hạn thực hiện</span>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-900 mt-2">
              {statusStats.deadline_passed || 0}
            </div>
            <span className="text-[10px] text-indigo-700/80 mt-1">Thông báo hết hạn</span>
          </Link>

          {/* 3. Hết hiệu lực */}
          <Link
            href="/admin/documents?status=expired"
            className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70 hover:bg-rose-100/70 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-800 text-[11px]">Hết hiệu lực</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-900 mt-2">
              {statusStats.expired || 0}
            </div>
            <span className="text-[10px] text-rose-700/80 mt-1">Đã bãi bỏ/hết hạn</span>
          </Link>

          {/* 4. Đã bị thay thế */}
          <Link
            href="/admin/documents?status=replaced"
            className="p-3 rounded-xl bg-slate-100 border border-slate-300/70 hover:bg-slate-200/70 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-[11px]">Đã thay thế</span>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
            </div>
            <div className="text-xl font-black text-slate-900 mt-2">
              {statusStats.replaced || 0}
            </div>
            <span className="text-[10px] text-slate-600 mt-1">Có văn bản mới</span>
          </Link>

          {/* 5. Chưa xác minh */}
          <Link
            href="/admin/documents?status=unverified"
            className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 hover:bg-amber-100/70 transition-colors flex flex-col justify-between col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-800 text-[11px]">Chưa xác minh</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-900 mt-2">
              {(statusStats.unverified || 0) + (statusStats.unknown || 0)}
            </div>
            <span className="text-[10px] text-amber-700/80 mt-1">Cần Admin duyệt</span>
          </Link>
        </div>
      </div>

      {/* 3. Thanh tóm tắt kỹ thuật nhỏ gọn */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-slate-700 font-medium">
            Hệ thống: <strong className="text-slate-900 font-bold">Hoạt động ổn định</strong> • Công cụ bóc tách: <strong className="text-slate-900">PyMuPDF, Tesseract OCR, python-docx</strong> • RAG: <strong className="text-slate-900">Hybrid Retrieval sẵn sàng</strong>
          </span>
        </div>
        <Link
          href="/admin/settings?tab=ai"
          className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex-shrink-0 self-start sm:self-auto"
        >
          Xem chi tiết cấu hình &amp; Pipeline →
        </Link>
      </div>

      {/* 4. Hai bảng nghiệp vụ chính: Hàng đợi bóc tách & Văn bản gần đây */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột 1: Hàng đợi xử lý tài liệu mới nhất */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tiến độ nhập tài liệu gần đây</h3>
              <p className="text-[11px] text-slate-500">Các file vừa upload vào hàng đợi xử lý nền</p>
            </div>
            <Link href="/admin/import" className="text-xs font-bold text-blue-600 hover:underline">
              Vào hàng đợi ({pendingCount + processingCount + processedCount + failedCount}) →
            </Link>
          </div>

          {recentImports.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Chưa có tài liệu nào trong hàng đợi upload.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentImports.map((imp) => (
                <div key={imp.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="truncate min-w-0">
                    <span className="font-semibold text-slate-800 block truncate">{imp.originalName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(imp.sizeBytes / 1024).toFixed(1)} KB • {new Date(imp.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    {getImportBadge(imp.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột 2: Văn bản đã công bố gần đây */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Văn bản số hóa gần đây</h3>
              <p className="text-[11px] text-slate-500">Tài liệu đã được công bố phục vụ hỏi đáp</p>
            </div>
            <Link href="/admin/documents" className="text-xs font-bold text-blue-600 hover:underline">
              Xem tất cả ({totalDocuments}) →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="truncate min-w-0">
                  <Link
                    href={`/admin/documents/${doc.id}`}
                    className="font-semibold text-slate-800 hover:text-blue-600 block truncate"
                  >
                    {doc.title}
                  </Link>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {doc.document_number || "Không có số hiệu"} • {doc.total_pages || 1} trang
                  </span>
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge status={doc.category} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
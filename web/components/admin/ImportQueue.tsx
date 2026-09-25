// web/components/admin/ImportQueue.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ImportedDocItem {
  id: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileFormat: string;
  sizeBytes: number;
  checksum: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED" | "PUBLISHED" | "DUPLICATE";
  errorMessage: string | null;
  retryCount: number;
  documentId: string | null;
  processedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  uploadedBy?: {
    name: string;
    email: string;
  };
}

interface Stats {
  pending: number;
  processing: number;
  processed: number;
  failed: number;
  published: number;
  duplicate: number;
  total: number;
}

export default function ImportQueue() {
  const [documents, setDocuments] = useState<ImportedDocItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    processing: 0,
    processed: 0,
    failed: 0,
    published: 0,
    duplicate: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Modal xem chi tiết & duyệt
  const [inspectDoc, setInspectDoc] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [editMetadata, setEditMetadata] = useState<any>({});
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const fetchQueue = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const url = activeTab === "ALL" ? "/api/admin/import" : `/api/admin/import?status=${activeTab}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("[fetchQueue Error]", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchQueue(false);
  }, [fetchQueue]);

  // Polling tự động mỗi 4s nếu có job PENDING hoặc PROCESSING
  useEffect(() => {
    const hasActiveJobs = stats.pending > 0 || stats.processing > 0;
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchQueue(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [stats.pending, stats.processing, fetchQueue]);

  // Mở modal xem chi tiết
  const handleOpenInspect = async (id: string) => {
    setInspectLoading(true);
    setPublishMessage(null);
    try {
      const res = await fetch(`/api/admin/import/${id}`);
      const data = await res.json();
      if (data.success && data.document) {
        setInspectDoc(data.document);
        const ext = data.document.extractedJson || {};
        const hints = ext.metadata_hints || {};
        const edited = data.document.editedMetadata || {};

        setEditMetadata({
          title: edited.title || hints.title_candidate || data.document.originalName,
          document_number: edited.document_number !== undefined ? edited.document_number : (hints.document_number || ""),
          issue_date: edited.issue_date !== undefined ? edited.issue_date : (hints.issue_date || ""),
          issuing_unit: edited.issuing_unit !== undefined ? edited.issuing_unit : (hints.issuing_unit || ""),
          category: edited.category !== undefined ? edited.category : (hints.category_hint || "Thông báo"),
          effective_status: edited.effective_status || "unknown",
        });
      }
    } catch (err) {
      alert("Lỗi tải chi tiết: " + err);
    } finally {
      setInspectLoading(false);
    }
  };

  // Lưu metadata
  const handleSaveMetadata = async () => {
    if (!inspectDoc) return;
    setSavingMetadata(true);
    try {
      const res = await fetch(`/api/admin/import/${inspectDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedMetadata: editMetadata }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Đã lưu thông tin chỉnh sửa thành công!");
        fetchQueue(true);
      } else {
        alert("Lỗi lưu metadata: " + data.error);
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setSavingMetadata(false);
    }
  };

  // Xử lý ngay (Sync Process)
  const handleSyncProcess = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/import/${id}/process?sync=true`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        fetchQueue(true);
      } else {
        alert("Xử lý thất bại: " + (data.message || data.error));
        fetchQueue(true);
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xóa tài liệu
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa file "${name}" khỏi hàng đợi?`)) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/import/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchQueue(true);
      } else {
        alert("Xóa thất bại: " + data.error);
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Publish tài liệu vào RAG
  const handlePublish = async (id: string) => {
    if (!confirm("Xác nhận duyệt và công bố tài liệu này vào kho dữ liệu RAG của hệ thống?")) return;
    setActionLoadingId(id);
    setPublishMessage(null);
    try {
      const res = await fetch(`/api/admin/import/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("🎉 Đã công bố văn bản thành công vào kho RAG!");
        setPublishMessage(data.message + " " + (data.embedding?.message || ""));
        fetchQueue(true);
        if (inspectDoc && inspectDoc.id === id) {
          setInspectDoc((prev: any) => ({ ...prev, status: "PUBLISHED" }));
        }
      } else {
        alert("Công bố thất bại: " + data.error);
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Publish tất cả đã chọn
  const handleBulkPublish = async () => {
    const idsToPublish = Array.from(selectedIds);
    if (!idsToPublish.length) {
      alert("Vui lòng chọn ít nhất 1 tài liệu ở trạng thái 'Đã bóc tách' để công bố.");
      return;
    }
    if (!confirm(`Xác nhận duyệt và công bố ${idsToPublish.length} tài liệu vào kho RAG?`)) return;

    setBulkPublishing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToPublish) {
      try {
        const res = await fetch(`/api/admin/import/${id}/publish`, { method: "POST" });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBulkPublishing(false);
    setSelectedIds(new Set());
    alert(`Hoàn tất duyệt hàng loạt: ${successCount} thành công, ${failCount} thất bại.`);
    fetchQueue(true);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllProcessed = () => {
    const processedIds = documents.filter((d) => d.status === "PROCESSED").map((d) => d.id);
    setSelectedIds(new Set(processedIds));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">Chờ xử lý</span>;
      case "PROCESSING":
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
            Đang bóc tách
          </span>
        );
      case "PROCESSED":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">Đã bóc tách (Chờ duyệt)</span>;
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
    <div className="space-y-5">
      {/* 1. Thanh Tabs Thống kê */}
      <div className="flex flex-wrap items-center gap-2 text-xs border-b border-slate-200 pb-3">
        {[
          { key: "ALL", label: "Tất cả", count: stats.total },
          { key: "PENDING", label: "Chờ xử lý", count: stats.pending },
          { key: "PROCESSING", label: "Đang bóc tách", count: stats.processing },
          { key: "PROCESSED", label: "Chờ duyệt", count: stats.processed },
          { key: "PUBLISHED", label: "Đã công bố", count: stats.published },
          { key: "FAILED", label: "Lỗi", count: stats.failed },
          { key: "DUPLICATE", label: "Trùng lặp", count: stats.duplicate },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.key ? "bg-blue-700 text-white" : "bg-white text-slate-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => fetchQueue(false)}
          className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* 2. Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <span className="text-blue-900 font-medium">
            Đã chọn <strong className="font-bold text-blue-700">{selectedIds.size}</strong> tài liệu đã bóc tách
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              onClick={handleBulkPublish}
              disabled={bulkPublishing}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              {bulkPublishing ? "Đang công bố..." : "Duyệt và công bố các mục đã chọn"}
            </button>
          </div>
        </div>
      )}

      {/* 3. Bảng danh sách tài liệu */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải dữ liệu hàng đợi...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-700">Hàng đợi rỗng</p>
            <p className="text-xs text-slate-400">Chưa có tài liệu nào trong danh mục trạng thái này.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) selectAllProcessed();
                        else setSelectedIds(new Set());
                      }}
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === documents.filter((d) => d.status === "PROCESSED").length
                      }
                      className="rounded border-slate-300 cursor-pointer"
                      title="Chọn tất cả mục đã bóc tách"
                    />
                  </th>
                  <th className="py-3 px-4">Tên tài liệu / Định dạng</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Dung lượng</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => {
                  const isActionLoading = actionLoadingId === doc.id;
                  const isSelected = selectedIds.has(doc.id);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        {doc.status === "PROCESSED" && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(doc.id)}
                            className="rounded border-slate-300 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                          {doc.originalName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-mono uppercase">{doc.fileFormat}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">
                            SHA: {doc.checksum.substring(0, 8)}...
                          </span>
                        </div>
                        {doc.errorMessage && (
                          <div className="mt-1 text-[11px] text-red-600 bg-red-50 p-1.5 rounded border border-red-100">
                            {doc.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                        {(doc.sizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {new Date(doc.createdAt).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        {/* Nút Xem preview & Duyệt */}
                        {(doc.status === "PROCESSED" || doc.status === "PUBLISHED") && (
                          <button
                            type="button"
                            onClick={() => handleOpenInspect(doc.id)}
                            className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Xem &amp; Duyệt
                          </button>
                        )}

                        {/* Nút Xử lý ngay nếu đang Pending */}
                        {doc.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleSyncProcess(doc.id)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            {isActionLoading ? "Đang chạy..." : "Bóc tách ngay"}
                          </button>
                        )}

                        {/* Nút Thử lại nếu Failed */}
                        {doc.status === "FAILED" && (
                          <button
                            type="button"
                            onClick={() => handleSyncProcess(doc.id)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            {isActionLoading ? "Đang thử lại..." : "Thử lại"}
                          </button>
                        )}

                        {/* Nút Công bố vào RAG */}
                        {doc.status === "PROCESSED" && (
                          <button
                            type="button"
                            onClick={() => handlePublish(doc.id)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {isActionLoading ? "Đang công bố..." : "Công bố"}
                          </button>
                        )}

                        {/* Nút Xóa (chỉ cho phép khi chưa PUBLISHED) */}
                        {doc.status !== "PUBLISHED" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.originalName)}
                            disabled={isActionLoading}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Xóa khỏi hàng đợi"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Modal Xem Chi Tiết & Duyệt Metadata */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 truncate max-w-lg">
                  {inspectDoc.originalName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: <span className="font-mono text-slate-700">{inspectDoc.id}</span> • Trạng thái: {getStatusBadge(inspectDoc.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {publishMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  {publishMessage}
                </div>
              )}

              {/* Form Metadata */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Thông tin pháp lý &amp; Metadata (Admin có thể hiệu chỉnh)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tiêu đề văn bản *
                    </label>
                    <input
                      type="text"
                      value={editMetadata.title || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Số hiệu văn bản (vd: 34/TB-ĐHKTĐN)
                    </label>
                    <input
                      type="text"
                      value={editMetadata.document_number || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, document_number: e.target.value })}
                      placeholder="Không có thì để trống"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Ngày ban hành (YYYY-MM-DD)
                    </label>
                    <input
                      type="text"
                      value={editMetadata.issue_date || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, issue_date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Đơn vị ban hành
                    </label>
                    <input
                      type="text"
                      value={editMetadata.issuing_unit || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, issuing_unit: e.target.value })}
                      placeholder="Trường Đại học Kiến trúc Đà Nẵng"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Chủ đề văn bản
                    </label>
                    <input
                      type="text"
                      value={editMetadata.category || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, category: e.target.value })}
                      placeholder="Học phí, Khảo thí, Đào tạo..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tình trạng hiệu lực (chỉ chọn khi văn bản nêu rõ)
                    </label>
                    <select
                      value={editMetadata.effective_status || "unknown"}
                      onChange={(e) => setEditMetadata({ ...editMetadata, effective_status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-blue-500"
                    >
                      <option value="unknown">Chưa xác định (Khuyên dùng khi không có căn cứ)</option>
                      <option value="effective">Còn hiệu lực</option>
                      <option value="expired">Hết hiệu lực</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={savingMetadata}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    {savingMetadata ? "Đang lưu..." : "Lưu thay đổi metadata"}
                  </button>
                </div>
              </div>

              {/* Preview Nội Dung Bóc Tách */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Nội dung bóc tách ({inspectDoc.extractedJson?.total_pages || 0} trang)
                </h4>

                {inspectDoc.extractedJson?.pages?.map((page: any, pIdx: number) => (
                  <div key={pIdx} className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 border-b border-slate-100 pb-1">
                      <span>TRANG {page.page_number}</span>
                      <span className="uppercase text-emerald-600 font-bold">{page.extraction_status}</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto font-mono text-[11px] text-slate-700 whitespace-pre-wrap bg-slate-50/50 p-2 rounded">
                      {page.cleaned_text || page.raw_text || "(Trang không có nội dung văn bản)"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>

              {inspectDoc.status === "PROCESSED" && (
                <button
                  type="button"
                  onClick={() => handlePublish(inspectDoc.id)}
                  disabled={actionLoadingId === inspectDoc.id}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Duyệt &amp; Công bố vào RAG</span>
                </button>
              )}

              {inspectDoc.status === "PUBLISHED" && (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  ✓ Tài liệu này đã được công bố trong kho RAG
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
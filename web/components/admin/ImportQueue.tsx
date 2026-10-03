// web/components/admin/ImportQueue.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import StatusBadge from "@/components/StatusBadge";

interface ImportedDocItem {
  id: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileFormat: string;
  sizeBytes: number;
  checksum: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED" | "PUBLISHED" | "DUPLICATE";
  sourceType?: "MANUAL_UPLOAD" | "CRAWLER";
  sourceUrl?: string | null;
  detailUrl?: string | null;
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

interface BulkProgress {
  active: boolean;
  mode: string;
  processed: number;
  failed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
  stopped?: boolean;
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
  const [batchSize, setBatchSize] = useState<number>(20);
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Tiến trình xử lý hàng loạt
  const [bulkProgress, setBulkProgress] = useState<BulkProgress>({
    active: false,
    mode: "",
    processed: 0,
    failed: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
    message: "",
  });
  const stopRequestedRef = useRef(false);

  // Modal xem chi tiết & duyệt
  const [inspectDoc, setInspectDoc] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [editMetadata, setEditMetadata] = useState<any>({});
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [activePageTab, setActivePageTab] = useState<number>(1);

  const fetchQueue = useCallback(
    async (isBackground = false) => {
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
    },
    [activeTab]
  );

  useEffect(() => {
    fetchQueue(false);
  }, [fetchQueue]);

  // Polling tự động mỗi 4s nếu có job PENDING hoặc PROCESSING
  useEffect(() => {
    const hasActiveJobs = stats.pending > 0 || stats.processing > 0 || bulkProgress.active;
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchQueue(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [stats.pending, stats.processing, bulkProgress.active, fetchQueue]);

  // Xử lý hàng loạt theo Batch
  const handleRunBulkProcess = async (mode: "ALL_PENDING" | "SELECTED" | "RETRY_FAILED") => {
    let idsToSend: string[] = [];
    let totalTargetCount = 0;

    if (mode === "SELECTED") {
      idsToSend = Array.from(selectedIds);
      if (idsToSend.length === 0) {
        alert("Vui lòng chọn ít nhất 1 tài liệu để xử lý.");
        return;
      }
      totalTargetCount = idsToSend.length;
    } else if (mode === "RETRY_FAILED") {
      if (stats.failed === 0) {
        alert("Không có tài liệu lỗi nào để thử lại.");
        return;
      }
      totalTargetCount = stats.failed;
    } else {
      if (stats.pending === 0) {
        alert("Không có tài liệu nào đang chờ xử lý.");
        return;
      }
      totalTargetCount = stats.pending;
    }

    stopRequestedRef.current = false;
    setBulkProgress({
      active: true,
      mode,
      processed: 0,
      failed: 0,
      total: totalTargetCount,
      currentBatch: 0,
      totalBatches: Math.ceil(totalTargetCount / batchSize) || 1,
      message: `Bắt đầu xử lý hàng loạt (${totalTargetCount} tài liệu, batch size = ${batchSize})...`,
    });

    let totalProcessed = 0;
    let totalFailed = 0;
    let batchIndex = 0;

    while (!stopRequestedRef.current) {
      batchIndex++;
      try {
        const res = await fetch("/api/admin/import/bulk-process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            ids: mode === "SELECTED" ? idsToSend : undefined,
            batchSize,
          }),
        });
        const data = await res.json();

        if (!data.success) {
          alert("Lỗi khi xử lý batch: " + data.error);
          break;
        }

        totalProcessed += data.processedCount || 0;
        totalFailed += data.failedCount || 0;

        setBulkProgress((prev) => ({
          ...prev,
          processed: totalProcessed,
          failed: totalFailed,
          currentBatch: batchIndex,
          message: data.message || `Đang xử lý batch ${batchIndex}...`,
        }));

        await fetchQueue(true);

        if (!data.hasMore || (data.remainingPending === 0 && mode === "ALL_PENDING")) {
          break;
        }

        if (mode === "SELECTED") {
          // Khi chọn cụ thể, 1 lần gọi đã lấy theo IDs (hoặc batch đầu)
          break;
        }
      } catch (err: any) {
        console.error("[Bulk Process Error]", err);
        setBulkProgress((prev) => ({
          ...prev,
          message: `Lỗi kết nối: ${err.message}`,
        }));
        break;
      }
    }

    setBulkProgress((prev) => ({
      ...prev,
      active: false,
      stopped: stopRequestedRef.current,
      message: stopRequestedRef.current
        ? `Đã dừng xử lý theo yêu cầu của Admin. Đã hoàn thành: ${totalProcessed} thành công, ${totalFailed} thất bại.`
        : `Hoàn tất xử lý hàng loạt: ${totalProcessed} thành công, ${totalFailed} thất bại.`,
    }));

    if (mode === "SELECTED") {
      setSelectedIds(new Set());
    }

    await fetchQueue(true);
  };

  const handleStopBulkProcess = () => {
    stopRequestedRef.current = true;
    setBulkProgress((prev) => ({
      ...prev,
      message: "Đang dừng... Đợi batch hiện tại hoàn tất.",
    }));
  };

  // Mở modal xem chi tiết & preview
  const handleOpenInspect = async (id: string) => {
    setInspectLoading(true);
    setPublishMessage(null);
    setActivePageTab(1);
    try {
      const res = await fetch(`/api/admin/import/${id}`);
      const data = await res.json();
      if (data.success && data.document) {
        setInspectDoc(data.document);
        const ext = data.document.extractedJson || {};
        const hints = ext.metadata_hints || {};
        const validity = ext.validity_analysis || {};
        const edited = data.document.editedMetadata || {};

        setEditMetadata({
          title: edited.title || hints.title_candidate || data.document.originalName,
          document_number:
            edited.document_number !== undefined
              ? edited.document_number
              : hints.document_number || "",
          issue_date:
            edited.issue_date !== undefined
              ? edited.issue_date
              : hints.issue_date || validity.issue_date || "",
          issuing_unit:
            edited.issuing_unit !== undefined
              ? edited.issuing_unit
              : hints.issuing_unit || "Trường Đại học Kiến trúc Đà Nẵng",
          category:
            edited.category !== undefined
              ? edited.category
              : hints.category_hint || "Thông báo",
          effective_status:
            edited.effective_status !== undefined
              ? edited.effective_status
              : validity.suggested_status || "unverified",
          status_evidence:
            edited.status_evidence !== undefined
              ? edited.status_evidence
              : validity.status_evidence || "",
          deadline:
            edited.deadline !== undefined
              ? edited.deadline
              : validity.deadline || "",
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

  // Xử lý 1 file ngay lập tức
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

  const selectAllPending = () => {
    const pendingIds = documents.filter((d) => d.status === "PENDING").map((d) => d.id);
    setSelectedIds(new Set(pendingIds));
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

  const progressPercentage =
    bulkProgress.total > 0
      ? Math.min(100, Math.round(((bulkProgress.processed + bulkProgress.failed) / bulkProgress.total) * 100))
      : 0;

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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Làm mới
        </button>
      </div>

      {/* 2. Thanh Công Cụ Xử Lý Hàng Loạt (Bulk Operations Bar) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>⚡</span>
              <span>Xử lý hàng loạt Import Queue</span>
            </span>
            <span className="text-slate-400 text-[11px]">
              (Chờ xử lý: <strong className="text-amber-400">{stats.pending}</strong> | Lỗi:{" "}
              <strong className="text-red-400">{stats.failed}</strong>)
            </span>
          </div>

          {/* Điều khiển Batch Size & Concurrency */}
          <div className="flex items-center gap-2">
            <label className="text-slate-300 text-[11px] font-medium">Batch size:</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
              disabled={bulkProgress.active}
              className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-blue-500"
            >
              <option value="10">10 file / batch</option>
              <option value="20">20 file / batch</option>
              <option value="50">50 file / batch</option>
              <option value="100">100 file / batch</option>
            </select>
          </div>
        </div>

        {/* Các nút hành động chính */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-700/60 text-xs">
          {/* Nút Xử lý tất cả PENDING */}
          <button
            type="button"
            onClick={() => handleRunBulkProcess("ALL_PENDING")}
            disabled={bulkProgress.active || stats.pending === 0}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              bulkProgress.active || stats.pending === 0
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
            }`}
          >
            <span>🚀</span>
            <span>Xử lý tất cả ({stats.pending} chờ)</span>
          </button>

          {/* Nút Thử lại tất cả lỗi */}
          {stats.failed > 0 && (
            <button
              type="button"
              onClick={() => handleRunBulkProcess("RETRY_FAILED")}
              disabled={bulkProgress.active}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔁</span>
              <span>Thử lại lỗi ({stats.failed})</span>
            </button>
          )}

          {/* Nút Xử lý mục đã chọn */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => handleRunBulkProcess("SELECTED")}
              disabled={bulkProgress.active}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡</span>
              <span>Bóc tách đã chọn ({selectedIds.size})</span>
            </button>
          )}

          {/* Nút Dừng xử lý */}
          {bulkProgress.active && (
            <button
              type="button"
              onClick={handleStopBulkProcess}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ml-auto animate-pulse"
            >
              <span>🛑</span>
              <span>Dừng xử lý</span>
            </button>
          )}
        </div>

        {/* Thanh tiến trình chi tiết khi chạy Bulk */}
        {(bulkProgress.active || bulkProgress.message) && (
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-700/80 space-y-2 mt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium">{bulkProgress.message}</span>
              <span className="font-mono font-bold text-blue-400">
                {bulkProgress.processed + bulkProgress.failed} / {bulkProgress.total || stats.pending} ({progressPercentage}%)
              </span>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
              <span className="text-emerald-400">✓ Thành công: {bulkProgress.processed}</span>
              <span className="text-red-400">✗ Thất bại: {bulkProgress.failed}</span>
              <span>Batch hiện tại: {bulkProgress.currentBatch}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bulk Actions Bar cho mục đã chọn để Publish */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <span className="text-blue-900 font-medium">
            Đã chọn <strong className="font-bold text-blue-700">{selectedIds.size}</strong> tài liệu
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
              {bulkPublishing ? "Đang công bố..." : "Duyệt & Công bố các mục đã chọn"}
            </button>
          </div>
        </div>
      )}

      {/* 4. Bảng danh sách tài liệu */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Đang tải dữ liệu hàng đợi...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
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
                  <th className="py-3 px-4">Tên tài liệu / Nguồn</th>
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
                        {(doc.status === "PROCESSED" || doc.status === "PENDING" || doc.status === "FAILED") && (
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
                          <span className="font-mono uppercase font-semibold text-slate-600">
                            {doc.fileFormat}
                          </span>
                          <span>•</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              doc.sourceType === "CRAWLER"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {doc.sourceType === "CRAWLER" ? "🔄 Crawler DAU" : "📤 Tải lên"}
                          </span>
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

                        {/* Nút Bóc tách ngay nếu đang Pending */}
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
                            {isActionLoading ? "Đang thử..." : "Thử lại"}
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

                        {/* Nút Xóa */}
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

      {/* 5. Modal Xem Chi Tiết, Báo Cáo Chất Lượng & Duyệt Metadata */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 truncate max-w-xl">
                  {inspectDoc.originalName}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>
                    ID: <span className="font-mono text-slate-700">{inspectDoc.id}</span>
                  </span>
                  <span>•</span>
                  <span>Trạng thái: {getStatusBadge(inspectDoc.status)}</span>
                  <span>•</span>
                  <span className="font-mono">SHA: {inspectDoc.checksum.substring(0, 10)}...</span>
                </div>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {publishMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium">
                  {publishMessage}
                </div>
              )}

              {/* Thẻ Nguồn gốc & Thu thập */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Nguồn tài liệu:</span>
                  <span className="font-semibold text-slate-800">
                    {inspectDoc.sourceType === "CRAWLER" ? "🔄 Thu thập tự động DAU" : "📤 Tải lên trực tiếp"}
                  </span>
                </div>
                {inspectDoc.detailUrl && (
                  <div className="sm:col-span-2 truncate">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">URL Chi tiết:</span>
                    <a
                      href={inspectDoc.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                    >
                      {inspectDoc.detailUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Báo cáo chất lượng & Hiệu lực pháp lý (2 cột) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Báo cáo chất lượng */}
                {inspectDoc.extractedJson?.quality_report && (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                        Đánh giá chất lượng dữ liệu
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          inspectDoc.extractedJson.quality_report.status === "GOOD"
                            ? "bg-emerald-100 text-emerald-800"
                            : inspectDoc.extractedJson.quality_report.status === "WARNING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        Điểm: {inspectDoc.extractedJson.quality_report.score}/100 (
                        {inspectDoc.extractedJson.quality_report.status})
                      </span>
                    </div>

                    {inspectDoc.extractedJson.quality_report.warnings?.length > 0 ? (
                      <div className="space-y-1 text-[11px] text-amber-700 bg-amber-50/70 p-2.5 rounded-lg border border-amber-100 max-h-28 overflow-y-auto">
                        {inspectDoc.extractedJson.quality_report.warnings.map((w: string, idx: number) => (
                          <div key={idx}>⚠️ {w}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-emerald-700 text-[11px]">✓ Dữ liệu đạt chuẩn chất lượng đầy đủ.</p>
                    )}
                  </div>
                )}

                {/* 2. Phân tích hiệu lực pháp lý */}
                {inspectDoc.extractedJson?.validity_analysis && (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                        Phân tích hiệu lực pháp lý
                      </h4>
                      <StatusBadge status={inspectDoc.extractedJson.validity_analysis.suggested_status} />
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                      <div>
                        <strong>Căn cứ:</strong>{" "}
                        <span className="italic">
                          {inspectDoc.extractedJson.validity_analysis.status_evidence ||
                            "Chưa tìm thấy điều khoản hiệu lực rõ ràng."}
                        </span>
                      </div>
                      {inspectDoc.extractedJson.validity_analysis.deadline && (
                        <div>
                          <strong>Hạn thực hiện:</strong>{" "}
                          <span className="font-mono text-red-600 font-bold">
                            {inspectDoc.extractedJson.validity_analysis.deadline}
                          </span>
                        </div>
                      )}
                      <div>
                        <strong>Mức độ tin cậy:</strong>{" "}
                        <span className="font-mono uppercase text-blue-600 font-bold">
                          {inspectDoc.extractedJson.validity_analysis.certainty || "LOW"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Metadata chỉnh sửa */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Thông tin pháp lý &amp; Metadata (Admin có thể hiệu chỉnh trước khi công bố)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Ước tính: ~{Math.max(1, inspectDoc.extractedJson?.total_pages || 1) * 2} chunks RAG
                  </span>
                </div>

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
                      onChange={(e) =>
                        setEditMetadata({ ...editMetadata, document_number: e.target.value })
                      }
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
                      onChange={(e) =>
                        setEditMetadata({ ...editMetadata, issuing_unit: e.target.value })
                      }
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
                      Tình trạng hiệu lực xác nhận
                    </label>
                    <select
                      value={editMetadata.effective_status || "unverified"}
                      onChange={(e) =>
                        setEditMetadata({ ...editMetadata, effective_status: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-blue-500"
                    >
                      <option value="unverified">Chưa xác định (Khuyên dùng khi không có căn cứ rõ ràng)</option>
                      <option value="active">Còn hiệu lực</option>
                      <option value="deadline_passed">Đã qua hạn thực hiện</option>
                      <option value="expired">Hết hiệu lực</option>
                      <option value="replaced">Đã bị thay thế</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Hạn thực hiện (Deadline nếu có)
                    </label>
                    <input
                      type="text"
                      value={editMetadata.deadline || ""}
                      onChange={(e) => setEditMetadata({ ...editMetadata, deadline: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Căn cứ xác định hiệu lực
                    </label>
                    <input
                      type="text"
                      value={editMetadata.status_evidence || ""}
                      onChange={(e) =>
                        setEditMetadata({ ...editMetadata, status_evidence: e.target.value })
                      }
                      placeholder="Trích dẫn câu/điều khoản trong văn bản..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-blue-500"
                    />
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

              {/* Preview Nội Dung Bóc Tách Từng Trang */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Nội dung bóc tách ({inspectDoc.extractedJson?.total_pages || 0} trang)
                  </h4>
                  {inspectDoc.extractedJson?.needs_ocr && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded-full">
                      🔍 Tự động OCR Scan tiếng Việt
                    </span>
                  )}
                </div>

                {inspectDoc.extractedJson?.pages?.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {inspectDoc.extractedJson.pages.map((p: any) => (
                      <button
                        key={p.page_number}
                        type="button"
                        onClick={() => setActivePageTab(p.page_number)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activePageTab === p.page_number
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Trang {p.page_number}
                      </button>
                    ))}
                  </div>
                )}

                {inspectDoc.extractedJson?.pages?.map((page: any, pIdx: number) => {
                  if (
                    inspectDoc.extractedJson.pages.length > 1 &&
                    page.page_number !== activePageTab
                  ) {
                    return null;
                  }

                  return (
                    <div
                      key={pIdx}
                      className="border border-slate-200 rounded-xl p-3 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 border-b border-slate-100 pb-1">
                        <span>TRANG {page.page_number}</span>
                        <span
                          className={`uppercase font-bold ${
                            page.extraction_status === "ok" || page.extraction_status === "ocr"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          Trạng thái: {page.extraction_status}
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto font-mono text-[11px] text-slate-700 whitespace-pre-wrap bg-slate-50/60 p-2.5 rounded leading-relaxed">
                        {page.cleaned_text || page.raw_text || "(Trang không có nội dung văn bản)"}
                      </div>
                    </div>
                  );
                })}
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
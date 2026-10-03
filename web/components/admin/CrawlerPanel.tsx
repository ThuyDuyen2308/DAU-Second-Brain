// web/components/admin/CrawlerPanel.tsx
"use client";

import React, { useState, useEffect } from "react";

interface CrawledItem {
  title: string;
  document_number: string | null;
  published_date: string | null;
  detail_url: string;
  attachments: string[];
  duplicate_status: "NEW" | "EXACT_DUPLICATE" | "LIKELY_DUPLICATE";
  duplicate_reason: string;
  source_page: number;
}

interface CrawlJobData {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "AUTH_REQUIRED" | "CAPTCHA_REQUIRED" | "ACCESS_BLOCKED";
  sourceUrl: string;
  maxPages: number;
  isDryRun: boolean;
  pagesScanned: number;
  itemsFound: number;
  newItems: number;
  duplicateItems: number;
  failedItems: number;
  downloadedFiles: number;
  skippedFiles: number;
  errorMessage?: string | null;
  summaryJson?: {
    items?: CrawledItem[];
    duration_seconds?: number;
  };
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export default function CrawlerPanel({ onQueueUpdated }: { onQueueUpdated?: () => void }) {
  const [maxPages, setMaxPages] = useState<number>(3);
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentJob, setCurrentJob] = useState<CrawlJobData | null>(null);
  const [recentJobs, setRecentJobs] = useState<CrawlJobData[]>([]);
  const [filterType, setFilterType] = useState<"ALL" | "NEW" | "EXACT_DUPLICATE" | "LIKELY_DUPLICATE">("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tải danh sách lịch sử crawl jobs khi mount
  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const res = await fetch("/api/admin/crawler/jobs?limit=5");
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && data.jobs.length > 0) {
          setRecentJobs(data.jobs);
          setCurrentJob(data.jobs[0]);
        }
      }
    } catch (err) {
      console.error("Không thể tải lịch sử crawl:", err);
    }
  }

  async function handleStartCrawl(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/crawler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPages,
          dryRun,
          sourceUrl: customUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể khởi chạy crawler.");
      }

      setCurrentJob(data.job);
      await loadJobs();
      if (onQueueUpdated) {
        onQueueUpdated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi khi thực thi crawler.");
    } finally {
      setIsLoading(false);
    }
  }

  const items: CrawledItem[] = currentJob?.summaryJson?.items || [];
  const filteredItems = items.filter((item) => {
    if (filterType === "ALL") return true;
    return item.duplicate_status === filterType;
  });

  function renderStatusBadge(status: string) {
    switch (status) {
      case "COMPLETED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">✓ Hoàn thành</span>;
      case "AUTH_REQUIRED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">🔒 Yêu cầu đăng nhập</span>;
      case "CAPTCHA_REQUIRED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">🛡️ Yêu cầu CAPTCHA</span>;
      case "ACCESS_BLOCKED":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">⛔ Bị chặn truy cập (403/429)</span>;
      case "RUNNING":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">⏳ Đang quét...</span>;
      case "PARTIAL":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">⚠️ Hoàn thành một phần</span>;
      case "FAILED":
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">❌ Lỗi</span>;
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Form điều khiển Quét thông báo */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🔄</span> Quét thông báo tự động từ DAU
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống tự động duyệt phân trang cổng thông tin DAU, phát hiện thông báo mới và tải file đính kèm đưa vào hàng đợi.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto cursor-pointer"
          >
            {showAdvanced ? "Ẩn cấu hình nâng cao ▲" : "Cấu hình nâng cao ▼"}
          </button>
        </div>

        <form onSubmit={handleStartCrawl} className="mt-5 space-y-4">
          {showAdvanced && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL nguồn quét tùy chỉnh (Mặc định: Cổng thông báo DAU)
                </label>
                <input
                  type="url"
                  placeholder="https://sinhvien.dau.edu.vn/sinh-vien/dm-tin/thong-bao.html"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Số trang tối đa:</label>
                <select
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  disabled={isLoading}
                  className="text-xs font-bold px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 trang (~50 thông báo)</option>
                  <option value={2}>2 trang (~100 thông báo)</option>
                  <option value={3}>3 trang (~150 thông báo)</option>
                  <option value={5}>5 trang (~250 thông báo)</option>
                  <option value={10}>10 trang (~500 thông báo)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Chạy thử (Dry Run — Không tải file, không ghi DB)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                isLoading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-95"
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Đang quét nguồn DAU...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Bắt đầu quét thông báo DAU</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Cảnh báo Tuân thủ Bảo mật đặc biệt */}
      {currentJob?.status === "AUTH_REQUIRED" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950 text-sm">Nguồn yêu cầu xác thực người dùng (AUTH_REQUIRED)</h4>
            <p className="leading-relaxed">
              Cổng thông tin DAU hiện đang chuyển hướng yêu cầu đăng nhập. Crawler tuân thủ nghiêm ngặt nguyên tắc bảo mật và không bypass trái phép. Admin có thể bổ sung file tài liệu thủ công tại tab <strong>Tải lên tài liệu</strong>.
            </p>
          </div>
        </div>
      )}

      {currentJob?.status === "CAPTCHA_REQUIRED" && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-xs text-orange-900 flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-orange-950 text-sm">Website yêu cầu giải mã CAPTCHA (CAPTCHA_REQUIRED)</h4>
            <p className="leading-relaxed">
              Trang web yêu cầu xác minh bảo mật chống bot. Crawler tự động dừng và không cố gắng bẻ khóa hoặc giải mã trái phép.
            </p>
          </div>
        </div>
      )}

      {currentJob?.status === "ACCESS_BLOCKED" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-xs text-red-900 flex items-start gap-3">
          <span className="text-xl">⛔</span>
          <div className="space-y-1">
            <h4 className="font-bold text-red-950 text-sm">Truy cập bị giới hạn hoặc từ chối (HTTP 403 / 429)</h4>
            <p className="leading-relaxed">
              Máy chủ DAU phản hồi chặn truy cập hoặc áp dụng giới hạn tần suất. Crawler đã tự động dừng lại để bảo vệ máy chủ.
            </p>
          </div>
        </div>
      )}

      {/* 3. Card Thống kê Lượt quét gần nhất */}
      {currentJob && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kết quả lượt quét gần nhất</span>
              <p className="text-xs text-slate-600 mt-0.5">
                Nguồn: <a href={currentJob.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{currentJob.sourceUrl}</a>
                {currentJob.finishedAt && (
                  <span className="ml-2 text-slate-400">
                    • {new Date(currentJob.finishedAt).toLocaleString("vi-VN")}
                  </span>
                )}
              </p>
            </div>
            <div>{renderStatusBadge(currentJob.status)}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-center">
              <span className="text-xs text-slate-500 block">Trang đã quét</span>
              <span className="text-xl font-black text-slate-800">{currentJob.pagesScanned}</span>
            </div>
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3.5 text-center">
              <span className="text-xs text-blue-600 block">Tổng tìm thấy</span>
              <span className="text-xl font-black text-blue-700">{currentJob.itemsFound}</span>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 text-center">
              <span className="text-xs text-emerald-600 block">Văn bản mới</span>
              <span className="text-xl font-black text-emerald-700">+{currentJob.newItems}</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3.5 text-center">
              <span className="text-xs text-amber-600 block">Trùng lặp</span>
              <span className="text-xl font-black text-amber-700">{currentJob.duplicateItems}</span>
            </div>
            <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-3.5 text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-purple-600 block">File đã tải</span>
              <span className="text-xl font-black text-purple-700">{currentJob.downloadedFiles}</span>
            </div>
          </div>

          {currentJob.isDryRun && (
            <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              ℹ️ Lượt quét này được thực hiện ở chế độ <strong>Dry Run</strong>. Không có tệp tin nào được tải về đĩa hoặc ghi vào database.
            </div>
          )}
        </div>
      )}

      {/* 4. Danh sách các thông báo trích xuất được */}
      {items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900">Danh sách thông báo phát hiện ({items.length})</h4>
              <p className="text-xs text-slate-500">Phân loại theo kết quả đối chiếu với kho tri thức hiện có</p>
            </div>

            {/* Bộ lọc */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterType("ALL")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === "ALL" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("NEW")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === "NEW" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mới ({items.filter((i) => i.duplicate_status === "NEW").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("EXACT_DUPLICATE")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === "EXACT_DUPLICATE" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Trùng lặp ({items.filter((i) => i.duplicate_status === "EXACT_DUPLICATE").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("LIKELY_DUPLICATE")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === "LIKELY_DUPLICATE" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Nghi trùng ({items.filter((i) => i.duplicate_status === "LIKELY_DUPLICATE").length})
              </button>
            </div>
          </div>

          {/* Bảng dữ liệu */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">STT</th>
                  <th className="py-3 px-4">Tiêu đề &amp; Số hiệu</th>
                  <th className="py-3 px-4">Ngày đăng</th>
                  <th className="py-3 px-4">Trang</th>
                  <th className="py-3 px-4">Đính kèm</th>
                  <th className="py-3 px-4">Phân loại trùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 max-w-md">
                      <a
                        href={item.detail_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-blue-600 transition-colors block font-semibold"
                      >
                        {item.title}
                      </a>
                      {item.document_number && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                          {item.document_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {item.published_date || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-center">
                      {item.source_page}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.attachments && item.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                          📎 {item.attachments.length} file
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.duplicate_status === "NEW" ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Mới
                        </span>
                      ) : item.duplicate_status === "EXACT_DUPLICATE" ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                          title={item.duplicate_reason}
                        >
                          Trùng khớp
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200"
                          title={item.duplicate_reason}
                        >
                          Nghi trùng
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

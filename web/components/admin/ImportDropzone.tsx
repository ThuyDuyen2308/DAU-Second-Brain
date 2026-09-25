// web/components/admin/ImportDropzone.tsx
"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";

interface FileItem {
  file: File;
  id: string;
  name: string;
  size: number;
  ext: string;
  isDocOld: boolean;
  isTooLarge: boolean;
  isEmpty: boolean;
}

interface UploadResponseItem {
  id?: string;
  name: string;
  status: "PENDING" | "DUPLICATE" | "FAILED";
  sizeBytes?: number;
  checksum?: string;
  message?: string;
  error?: string;
}

interface ImportDropzoneProps {
  onUploadSuccess: () => void;
}

export default function ImportDropzone({ onUploadSuccess }: ImportDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    uploaded: number;
    duplicates: number;
    failed: number;
    items: UploadResponseItem[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
  const MAX_FILES = 100;

  const processFileList = (files: FileList | File[]) => {
    setErrorMessage(null);
    setUploadResults(null);

    const newItems: FileItem[] = [];
    const currentCount = selectedFiles.length;

    for (let i = 0; i < files.length; i++) {
      if (currentCount + newItems.length >= MAX_FILES) {
        setErrorMessage(`Đã đạt giới hạn tối đa ${MAX_FILES} file mỗi đợt. Các file vượt quá đã được bỏ qua.`);
        break;
      }

      const file = files[i];
      const ext = ("." + (file.name.split(".").pop() || "")).toLowerCase();
      const isDocOld = ext === ".doc";
      const isTooLarge = file.size > MAX_FILE_SIZE;
      const isEmpty = file.size === 0;

      newItems.push({
        file,
        id: `${file.name}_${file.size}_${file.lastModified}_${Math.random()}`,
        name: file.name,
        size: file.size,
        ext,
        isDocOld,
        isTooLarge,
        isEmpty,
      });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadResults(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const totalSize = selectedFiles.reduce((acc, cur) => acc + cur.size, 0);
  const hasInvalidFiles = selectedFiles.some((f) => f.isDocOld || f.isTooLarge || f.isEmpty);

  const handleStartUpload = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    setErrorMessage(null);
    setUploadResults(null);

    try {
      const formData = new FormData();
      // Chỉ gửi các file không vi phạm
      const validFiles = selectedFiles.filter((f) => !f.isDocOld && !f.isTooLarge && !f.isEmpty);

      if (!validFiles.length) {
        setErrorMessage("Không có file nào hợp lệ để upload. Vui lòng kiểm tra lại các cảnh báo định dạng hoặc dung lượng.");
        setUploading(false);
        return;
      }

      for (const item of validFiles) {
        formData.append("files", item.file);
      }

      const res = await fetch("/api/admin/import/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload thất bại.");
      }

      setUploadResults(data);
      // Xóa các file đã xử lý thành công khỏi danh sách chọn
      setSelectedFiles([]);
      onUploadSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi không xác định khi upload.");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* 1. Khu vực kéo thả file */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50/60 scale-[1.005]"
            : "border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.html,.htm"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">
              Kéo thả tập tin vào đây hoặc <span className="text-blue-600 hover:underline">duyệt từ máy tính</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Hỗ trợ định dạng: <span className="font-semibold text-slate-700">PDF, DOCX, HTML</span> • Tối đa 20MB/file • Tối đa 100 file/batch
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Chọn nhiều file
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Chọn cả thư mục
            </button>
          </div>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Danh sách file đang được chọn */}
      {selectedFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tập tin đã chọn ({selectedFiles.length} file)
              </h3>
              <p className="text-xs text-slate-500">
                Tổng dung lượng: <span className="font-semibold text-slate-700">{formatSize(totalSize)}</span> / 500MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={uploading}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                Xóa tất cả
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={uploading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Đang upload dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Bắt đầu import ({selectedFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {hasInvalidFiles && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
              ⚠️ Có một số file bị cảnh báo (file .doc cũ cần chuyển sang .docx, hoặc vượt quá 20MB). Các file này sẽ tự động bị bỏ qua khi bấm "Bắt đầu import".
            </div>
          )}

          {/* List scroll */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
            {selectedFiles.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {item.ext.replace(".", "") || "FILE"}
                  </span>
                  <div className="truncate">
                    <span className="font-medium text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[10px] text-slate-400">{formatSize(item.size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.isDocOld && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Cần đổi sang .docx
                    </span>
                  )}
                  {item.isTooLarge && (
                    <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      &gt; 20MB
                    </span>
                  )}
                  {item.isEmpty && (
                    <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      File rỗng
                    </span>
                  )}
                  {!item.isDocOld && !item.isTooLarge && !item.isEmpty && (
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Hợp lệ
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(item.id)}
                    disabled={uploading}
                    className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                    title="Bỏ chọn file này"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Kết quả sau upload */}
      {uploadResults && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Kết quả upload đợt này</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Thành công: <span className="font-bold text-emerald-600">{uploadResults.uploaded}</span> • Trùng lặp: <span className="font-bold text-amber-600">{uploadResults.duplicates}</span> • Lỗi: <span className="font-bold text-red-600">{uploadResults.failed}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadResults(null)}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Đóng kết quả
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
            {uploadResults.items.map((res, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between gap-3">
                <div className="truncate">
                  <span className="font-medium text-slate-800 block truncate">{res.name}</span>
                  <span className="text-[11px] text-slate-500">{res.message || res.error}</span>
                </div>
                <div className="flex-shrink-0">
                  {res.status === "PENDING" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Chờ xử lý
                    </span>
                  )}
                  {res.status === "DUPLICATE" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      File trùng
                    </span>
                  )}
                  {res.status === "FAILED" && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      Thất bại
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
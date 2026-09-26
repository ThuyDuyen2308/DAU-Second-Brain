// app/admin/documents/page.tsx
import React, { Suspense } from "react";
import AdminDocumentsClient from "@/components/admin/AdminDocumentsClient";
import { getAllDocuments, getCategoryStats } from "@/lib/documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quản lý tài liệu & Danh mục | DAU Second Brain Admin",
  description: "Quản lý kho văn bản và danh mục tri thức số hóa của DAU Second Brain",
};

export const dynamic = "force-dynamic";

export default function AdminDocumentsPage() {
  const allDocs = getAllDocuments();
  const catStats = getCategoryStats();

  return (
    <Suspense fallback={<div className="p-6 text-xs text-slate-400">Đang tải kho tài liệu...</div>}>
      <AdminDocumentsClient documents={allDocs} categoryStats={catStats} />
    </Suspense>
  );
}
// app/admin/documents/page.tsx
import React from "react";
import AdminDocumentsClient from "@/components/admin/AdminDocumentsClient";
import { getAllDocuments } from "@/lib/documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quản lý văn bản | DAU Second Brain Admin",
  description: "Quản lý kho văn bản và tài liệu số hóa của DAU Second Brain",
};

export default function AdminDocumentsPage() {
  const allDocs = getAllDocuments();

  return <AdminDocumentsClient documents={allDocs} />;
}

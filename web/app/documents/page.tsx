// app/documents/page.tsx
import { Suspense } from "react";
import DocumentList from "@/components/DocumentList";
import { getAllDocuments, getCategoryStats } from "@/lib/documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tra cứu văn bản | DAU Second Brain",
  description: "Tìm kiếm và khám phá các văn bản trong kho dữ liệu nhà trường.",
};

interface DocumentsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const allDocs = getAllDocuments();
  const categoryStats = getCategoryStats();
  const categories = categoryStats.map((c) => c.name);

  return (
    <div className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header trang */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
          <span>Kho tri thức số</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Tra cứu văn bản
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5 max-w-2xl">
          Tìm kiếm và khám phá các văn bản trong kho dữ liệu nhà trường.
        </p>
      </div>

      <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Đang tải kho văn bản...</div>}>
        <DocumentList
          initialDocuments={allDocs}
          categories={categories}
          initialQuery={params.q || ""}
          initialCategory={params.category || "all"}
        />
      </Suspense>
    </div>
  );
}

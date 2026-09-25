// app/categories/page.tsx
import Link from "next/link";
import CategoryCard from "@/components/CategoryCard";
import { getCategoryStats, getAllDocuments } from "@/lib/documents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chủ đề văn bản | DAU Second Brain",
  description: "Khám phá các văn bản theo nhóm chủ đề chính thức của Trường Đại học Kiến trúc Đà Nẵng.",
};

export default function CategoriesPage() {
  const categories = getCategoryStats();
  const allDocs = getAllDocuments();

  return (
    <div className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* Header trang */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
          <span>Phân loại đào tạo</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Khám phá theo chủ đề
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5 max-w-2xl">
          Phân loại kho văn bản theo lĩnh vực hoạt động và quy chế đào tạo của Trường Đại học Kiến trúc Đà Nẵng.
        </p>
      </div>

      {/* Grid danh mục chủ đề */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.name}
            name={cat.name}
            count={cat.count}
            subcategories={cat.subcategories}
          />
        ))}
      </div>

      {/* Văn bản theo từng nhóm chi tiết */}
      <div className="space-y-10 pt-6">
        {categories.map((cat) => {
          const docsInCat = allDocs.filter((d) => d.category === cat.name);

          return (
            <div
              key={cat.name}
              className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                    <span>{cat.name}</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {cat.count} văn bản
                    </span>
                  </h2>
                  {cat.subcategories.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Phân nhóm: {cat.subcategories.join(" • ")}
                    </p>
                  )}
                </div>

                <Link
                  href={`/documents?category=${encodeURIComponent(cat.name)}`}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Xem tất cả văn bản nhóm này →
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docsInCat.map((d) => (
                  <Link
                    key={d.id}
                    href={`/documents/${d.id}`}
                    className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50/50 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                        <span>{d.document_number || "Chưa có số VB"}</span>
                        <span>{d.issue_date || "Chưa rõ ngày"}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                        {d.title}
                      </h4>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>{d.total_pages} trang</span>
                      <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        Xem chi tiết →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
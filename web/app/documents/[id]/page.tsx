import { notFound } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { getDocumentById, getAllDocuments } from "@/lib/documents";
import type { Metadata } from "next";

interface DocumentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateStaticParams() {
  const docs = getAllDocuments();
  return docs.map((doc) => ({
    id: doc.id,
  }));
}

export async function generateMetadata({ params }: DocumentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = getDocumentById(id);
  if (!doc) return { title: "Văn bản không tồn tại | DAU Second Brain" };
  return {
    title: `${doc.title} | DAU Second Brain`,
    description: `Chi tiết văn bản số ${doc.document_number || "chưa xác định"} - Trường Đại học Kiến trúc Đà Nẵng`,
  };
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { id } = await params;
  const doc = getDocumentById(id);

  if (!doc) {
    notFound();
  }

  // Link văn bản gốc
  const originalUrl = doc.source_url || doc.detail_url || null;

  return (
    <div className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Breadcrumb điều hướng */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link href="/documents" className="hover:text-blue-600 transition-colors">
          Tra cứu văn bản
        </Link>
        <span>/</span>
        <span className="text-slate-800 truncate max-w-xs sm:max-w-md font-semibold">
          {doc.title}
        </span>
      </nav>

      {/* Grid 2 cột: Cột chính (Nội dung & Pages) & Cột phải (Metadata & Nguồn dữ liệu) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CỘT CHÍNH (LEFT / MAIN) - 8 cột */}
        <div className="lg:col-span-8 space-y-8">
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {doc.category ? (
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                    {doc.category}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                    Chưa phân loại
                  </span>
                )}
                {doc.subcategory && (
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                    {doc.subcategory}
                  </span>
                )}
              </div>
              <StatusBadge status={doc.effective_status} size="md" />
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug">
              {doc.title}
            </h1>

            {/* Quick stats trong Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Số hiệu văn bản</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {doc.document_number || <span className="text-slate-400 italic font-sans">Chưa có thông tin</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Ngày ban hành</span>
                <span className="font-semibold text-slate-800">
                  {doc.issue_date || <span className="text-slate-400 italic">Chưa có thông tin</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Đơn vị ban hành</span>
                <span className="font-semibold text-slate-800">
                  {doc.issuing_unit || <span className="text-slate-400 italic">Chưa có thông tin</span>}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Quy mô</span>
                <span className="font-semibold text-slate-800">
                  {doc.total_pages} trang ({doc.file_format?.toUpperCase() || "PDF"})
                </span>
              </div>
            </div>
          </div>

          {/* Nội dung OCR theo từng trang (Document Paper cards) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Nội dung văn bản số hóa</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {doc.pages.length} trang
                </span>
              </h2>
              <span className="text-xs text-slate-500">Trích xuất nguyên bản qua OCR tiếng Việt</span>
            </div>

            {doc.pages.length > 0 ? (
              doc.pages.map((p) => (
                <div
                  key={p.page_number}
                  id={`page-${p.page_number}`}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4 scroll-mt-24"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-md">
                      Trang {p.page_number}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {p.cleaned_text?.length || 0} ký tự
                    </span>
                  </div>

                  {/* Vùng hiển thị văn bản học thuật */}
                  <div className="prose-content font-sans text-sm sm:text-base leading-[1.8] text-slate-800 select-text">
                    {p.cleaned_text || (
                      <span className="italic text-slate-400">
                        Trang này không chứa văn bản (trang giấy trắng hoặc chỉ có hình ảnh không chữ).
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500">
                {doc.content || "Chưa có nội dung văn bản."}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (RIGHT SIDEBAR) - 4 cột */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Nguồn văn bản & Hành động tải gốc */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              Nguồn văn bản
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Văn bản được lưu trữ và đối soát từ hệ thống chính thức của Trường Đại học Kiến trúc Đà Nẵng.
            </p>

            {originalUrl && (
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
              >
                <span>Xem văn bản gốc</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {doc.detail_url && (
              <a
                href={doc.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
              >
                <span>Mở trang thông báo</span>
                <span className="text-slate-400">↗</span>
              </a>
            )}
          </div>

          {/* Card 2: Thông tin chi tiết Document Information */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3.5 text-xs">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Thông tin chi tiết
            </h3>

            <div>
              <span className="text-slate-400 block mb-0.5">Số hiệu văn bản:</span>
              <span className="font-semibold text-slate-800">
                {doc.document_number || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Ngày ban hành:</span>
              <span className="font-semibold text-slate-800">
                {doc.issue_date || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Đơn vị ban hành:</span>
              <span className="font-semibold text-slate-800">
                {doc.issuing_unit || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Chủ đề đào tạo:</span>
              <span className="font-semibold text-slate-800">
                {doc.category || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Trạng thái hiệu lực:</span>
              <span className="font-semibold text-slate-800">
                {doc.effective_status === "unknown" ? "Chưa xác định hiệu lực" : doc.effective_status}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Hạn chót thực hiện:</span>
              <span className="font-semibold text-slate-800">
                {doc.deadline || "Chưa có thông tin"}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Chất lượng OCR:</span>
              <span className="font-semibold text-slate-800">
                {doc.metadata?.ocr_quality?.label || "GOOD"} ({doc.metadata?.ocr_quality?.score || 100}/100)
              </span>
            </div>
          </div>

          {/* Card 3: Nguồn gốc Provenance (hỗ trợ mở rộng xem chi tiết kỹ thuật) */}
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 text-xs text-slate-600 space-y-2.5">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs pb-1 border-b border-slate-200">
              Truy vết nguồn gốc (Provenance)
            </h3>

            <div>
              <span className="font-semibold text-slate-700 block">Mã định danh ID:</span>
              <span className="font-mono text-[11px] text-slate-600">{doc.id}</span>
            </div>

            {doc.provenance?.document_file && (
              <div>
                <span className="font-semibold text-slate-700 block">Tệp tài liệu:</span>
                <span className="font-mono text-[11px] text-slate-500 break-all">
                  {doc.provenance.document_file}
                </span>
              </div>
            )}

            {doc.provenance?.extracted_file && (
              <div>
                <span className="font-semibold text-slate-700 block">Tệp OCR trích xuất:</span>
                <span className="font-mono text-[11px] text-slate-500 break-all">
                  {doc.provenance.extracted_file}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
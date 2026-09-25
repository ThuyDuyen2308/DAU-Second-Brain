// app/page.tsx
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import DocumentCard from "@/components/DocumentCard";
import CategoryCard from "@/components/CategoryCard";
import StatCard from "@/components/StatCard";
import { getAllDocuments, getCategoryStats, getRecentDocuments } from "@/lib/documents";

export default function HomePage() {
  const allDocs = getAllDocuments();
  const categories = getCategoryStats();
  const recentDocs = getRecentDocuments(4);

  // Tính toán động trực tiếp từ dataset, không hard-code
  const totalDocuments = allDocs.length;
  const totalPages = allDocs.reduce((acc, d) => acc + (d.total_pages || 0), 0);
  const totalCategories = categories.length;

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-12 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Cột trái: Nội dung chính & Search */}
            <div className="lg:col-span-7 text-left space-y-6">
              {/* Badge học thuật */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                <span>DAU SECOND BRAIN</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                <span className="text-blue-600 block">Tra cứu văn bản</span> nhà trường nhanh hơn, chính xác hơn.
              </h1>

              {/* Subheadline trung thực */}
              <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed font-normal">
                Kho tri thức số giúp sinh viên tìm kiếm, đọc và tra cứu thông tin từ các văn bản chính thức của Trường Đại học Kiến trúc Đà Nẵng.
              </p>

              {/* Search Box lớn */}
              <div className="pt-2 max-w-2xl">
                <SearchBar placeholder="Bạn muốn tìm văn bản hoặc thông tin gì?" />

                {/* Từ khóa gợi ý từ dataset */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-400">Gợi ý tìm kiếm:</span>
                  {["Học phí", "Phúc khảo", "Chuẩn đầu ra", "Khảo sát", "Tốt nghiệp"].map((keyword) => (
                    <Link
                      key={keyword}
                      href={`/documents?q=${encodeURIComponent(keyword)}`}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-2xs text-xs"
                    >
                      {keyword}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Cột phải: Hero Visual (Mockup Card hiện đại) */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-sm relative">
                {/* Visual Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      DAU
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Văn bản số hóa
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span>
                    Chưa xác định hiệu lực
                  </span>
                </div>

                {/* Visual Document Content */}
                <div className="space-y-3">
                  <div className="text-[11px] font-mono text-slate-400">
                    Số: 34/TB-ĐHKTĐN • 2026-08-03
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">
                    Thông báo về việc nộp học phí và bảo hiểm trong học kỳ I năm học 2026-2027
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
                    Căn cứ quyết định của Hiệu trưởng Trường Đại học Kiến trúc Đà Nẵng về việc thu học phí và các khoản bảo hiểm bắt buộc...
                  </p>
                </div>

                {/* Visual Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Trích xuất OCR tiếng Việt</span>
                  <span className="font-semibold text-blue-600">5 trang PDF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATISTICS SECTION (Tự tính từ data) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            value={totalDocuments}
            label="Văn bản mẫu"
            sublabel="Đã chuẩn hóa schema"
          />
          <StatCard
            value={totalPages}
            label="Trang tài liệu"
            sublabel="OCR tiếng Việt đầy đủ"
          />
          <StatCard
            value={totalCategories}
            label="Nhóm chủ đề"
            sublabel="Phân loại từ dữ liệu"
          />
          <StatCard
            value="100%"
            label="Dữ liệu có nguồn"
            sublabel="Có xuất xứ provenance"
          />
        </div>
      </section>

      {/* 3. SECTION KHÁM PHÁ THEO CHỦ ĐỀ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
              Danh mục tài liệu
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Bạn đang tìm thông tin gì?
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
          >
            <span>Xem tất cả chủ đề</span>
            <span>→</span>
          </Link>
        </div>

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
      </section>

      {/* 4. SECTION VĂN BẢN MỚI NHẤT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
              Kho tài liệu số
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Văn bản mới nhất
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cập nhật từ kho văn bản nhà trường
            </p>
          </div>
          <Link
            href="/documents"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
          >
            <span>Xem toàn bộ kho văn bản</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recentDocs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      </section>

      {/* 5. SECTION HỎI ĐÁP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 rounded-3xl p-8 sm:p-12 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold uppercase tracking-wider">
              <span>Trợ lý hỏi đáp văn bản DAU</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Không biết bắt đầu tìm từ đâu?
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Đặt câu hỏi bằng ngôn ngữ tự nhiên để tra cứu học phí, thủ tục và nhận trích dẫn trực tiếp từ kho văn bản nhà trường.
            </p>
          </div>
          <div>
            <Link
              href="/ask"
              className="inline-flex items-center px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100 font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              Đặt câu hỏi ngay →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

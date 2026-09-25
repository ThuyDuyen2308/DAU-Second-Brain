// app/ask/page.tsx
import ChatBox from "@/components/ChatBox";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hỏi đáp văn bản | DAU Second Brain",
  description:
    "Đặt câu hỏi về học phí, phúc khảo, thủ tục, quy định và các thông báo của Trường Đại học Kiến trúc Đà Nẵng.",
};

export default function AskPage() {
  return (
    <div className="py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-8">
      {/* Header trang */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
          <span>Trợ lý văn bản DAU</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Hỏi đáp thông tin DAU
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
          Đặt câu hỏi về học phí, phúc khảo, thủ tục, quy định và các thông
          báo của Trường Đại học Kiến trúc Đà Nẵng.
        </p>

        <p className="text-xs text-slate-400">
          Câu trả lời được đối chiếu trực tiếp với kho văn bản chính thức của
          nhà trường.
        </p>
      </div>

      {/* Giao diện ChatBox */}
      <ChatBox />
    </div>
  );
}
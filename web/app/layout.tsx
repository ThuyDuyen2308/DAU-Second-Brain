import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "DAU Second Brain - Trợ lý tra cứu văn bản nhà trường",
  description:
    "Hệ thống trợ lý thông minh hỗ trợ sinh viên và giảng viên tra cứu thông báo, quy chế, học phí và chuẩn đầu ra chính thức của Trường Đại học Kiến trúc Đà Nẵng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

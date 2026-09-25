// app/page.tsx
import ChatInterface from "@/components/chat/ChatInterface";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DAU Second Brain — Trợ lý Tra cứu & Hỏi đáp Văn bản DAU",
  description: "Trợ lý hỏi đáp quy định, thông báo, học phí Trường Đại học Kiến trúc Đà Nẵng",
};

export default function HomePage() {
  return <ChatInterface />;
}

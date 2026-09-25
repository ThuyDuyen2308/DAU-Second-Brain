// app/ask/page.tsx
import ChatInterface from "@/components/chat/ChatInterface";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hỏi đáp AI | DAU Second Brain",
  description: "Trợ lý hỏi đáp quy định, thông báo, học phí Trường Đại học Kiến trúc Đà Nẵng",
};

export default function AskPage() {
  return <ChatInterface />;
}
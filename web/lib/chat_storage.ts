// web/lib/chat_storage.ts
import { Conversation } from "@/types/ask";

const STORAGE_KEY = "dau_chat_conversations";

/**
 * Đọc danh sách cuộc trò chuyện từ localStorage
 */
export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: Conversation[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Lỗi đọc lịch sử chat từ localStorage:", error);
    return [];
  }
}

/**
 * Lưu danh sách cuộc trò chuyện vào localStorage
 */
export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error("Lỗi ghi lịch sử chat vào localStorage:", error);
  }
}

/**
 * Tạo tiêu đề ngắn tự động từ câu hỏi đầu tiên (40 - 60 ký tự)
 */
export function generateTitleFromQuestion(question: string): string {
  const clean = question.trim().replace(/\s+/g, " ");
  if (clean.length <= 45) return clean;
  
  // Cắt ở từ gần nhất trong khoảng 40-50 ký tự
  const truncated = clean.substring(0, 48);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 25) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

/**
 * Nhóm các cuộc trò chuyện theo mốc thời gian: Hôm nay, Hôm qua, 7 ngày trước, Cũ hơn
 */
export function groupConversationsByDate(conversations: Conversation[]): {
  today: Conversation[];
  yesterday: Conversation[];
  last7Days: Conversation[];
  older: Conversation[];
} {
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7Days: Conversation[] = [];
  const older: Conversation[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 6 * 86400000;

  // Sắp xếp các cuộc trò chuyện mới nhất lên đầu
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  for (const conv of sorted) {
    const convTime = new Date(conv.updatedAt).getTime();
    if (convTime >= startOfToday) {
      today.push(conv);
    } else if (convTime >= startOfYesterday) {
      yesterday.push(conv);
    } else if (convTime >= startOf7Days) {
      last7Days.push(conv);
    } else {
      older.push(conv);
    }
  }

  return {
    today,
    yesterday,
    last7Days,
    older,
  };
}

import fs from "fs";
import path from "path";
import { Document, CategoryStats } from "@/types/document";

// Đường dẫn đến file dataset chuẩn hóa
const DATASET_PATH = path.resolve(process.cwd(), "../crawler/data/normalized/documents.json");

/**
 * Đọc toàn bộ danh sách văn bản từ dataset chuẩn hóa
 */
export function getAllDocuments(): Document[] {
  try {
    if (!fs.existsSync(DATASET_PATH)) {
      console.warn(`[getAllDocuments] Dataset file not found at: ${DATASET_PATH}`);
      return [];
    }
    const fileContent = fs.readFileSync(DATASET_PATH, "utf-8");
    const documents: Document[] = JSON.parse(fileContent);
    return documents;
  } catch (error) {
    console.error("[getAllDocuments] Error reading documents.json:", error);
    return [];
  }
}

/**
 * Lấy chi tiết một văn bản theo ID
 */
export function getDocumentById(id: string): Document | null {
  const docs = getAllDocuments();
  return docs.find((d) => d.id === id) || null;
}

/**
 * Lọc và tìm kiếm văn bản
 */
export function searchDocuments(params: {
  query?: string;
  category?: string;
  effectiveStatus?: string;
  year?: string;
}): Document[] {
  let docs = getAllDocuments();

  if (params.query) {
    const q = params.query.toLowerCase().trim();
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.document_number && d.document_number.toLowerCase().includes(q)) ||
        (d.content && d.content.toLowerCase().includes(q))
    );
  }

  if (params.category && params.category !== "all") {
    docs = docs.filter((d) => d.category === params.category);
  }

  if (params.effectiveStatus && params.effectiveStatus !== "all") {
    docs = docs.filter((d) => d.effective_status === params.effectiveStatus);
  }

  if (params.year && params.year !== "all") {
    docs = docs.filter((d) => d.issue_date && d.issue_date.startsWith(params.year!));
  }

  return docs;
}

/**
 * Thống kê danh mục chủ đề
 */
export function getCategoryStats(): CategoryStats[] {
  const docs = getAllDocuments();
  const catMap: Record<string, { count: number; subcategories: Set<string> }> = {};

  for (const doc of docs) {
    const catName = doc.category || "Chưa phân loại";
    if (!catMap[catName]) {
      catMap[catName] = { count: 0, subcategories: new Set() };
    }
    catMap[catName].count += 1;
    if (doc.subcategory) {
      catMap[catName].subcategories.add(doc.subcategory);
    }
  }

  return Object.entries(catMap).map(([name, data]) => ({
    name,
    count: data.count,
    subcategories: Array.from(data.subcategories),
  }));
}

/**
 * Lấy các văn bản mới nhất
 */
export function getRecentDocuments(limit = 5): Document[] {
  const docs = getAllDocuments();
  return docs
    .slice()
    .sort((a, b) => {
      const dateA = a.issue_date || "";
      const dateB = b.issue_date || "";
      return dateB.localeCompare(dateA);
    })
    .slice(0, limit);
}

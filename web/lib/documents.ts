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

/**
 * Cập nhật tình trạng hiệu lực văn bản an toàn kèm kiểm toán (Admin Verification)
 */
export function updateDocumentValidity(
  id: string,
  updates: {
    effective_status?: Document["effective_status"];
    deadline?: string | null;
    effective_from?: string | null;
    effective_to?: string | null;
    replaced_by?: string | null;
    status_evidence?: string | null;
    status_rationale?: string | null;
    verified_by?: string | null;
    verification_note?: string | null;
  }
): Document | null {
  try {
    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`Dataset file not found at: ${DATASET_PATH}`);
    }
    const fileContent = fs.readFileSync(DATASET_PATH, "utf-8");
    const documents: Document[] = JSON.parse(fileContent);

    const docIndex = documents.findIndex((d) => d.id === id);
    if (docIndex === -1) {
      return null;
    }

    const doc = documents[docIndex];
    const prevStatus = doc.effective_status;
    const nowIso = new Date().toISOString();

    const historyEntry = {
      previous_status: prevStatus,
      new_status: updates.effective_status || prevStatus,
      changed_by: updates.verified_by || "admin",
      changed_at: nowIso,
      evidence: updates.status_evidence || doc.status_evidence || null,
      note: updates.verification_note || null,
    };

    const updatedHistory = Array.isArray(doc.status_history)
      ? [...doc.status_history, historyEntry]
      : [historyEntry];

    const updatedDoc: Document = {
      ...doc,
      effective_status: updates.effective_status || doc.effective_status,
      deadline: updates.deadline !== undefined ? updates.deadline : doc.deadline,
      effective_from: updates.effective_from !== undefined ? updates.effective_from : doc.effective_from,
      effective_to: updates.effective_to !== undefined ? updates.effective_to : doc.effective_to,
      replaced_by: updates.replaced_by !== undefined ? updates.replaced_by : doc.replaced_by,
      status_evidence: updates.status_evidence !== undefined ? updates.status_evidence : doc.status_evidence,
      status_rationale: updates.status_rationale !== undefined ? updates.status_rationale : doc.status_rationale,
      is_verified: true,
      verified_by: updates.verified_by || doc.verified_by || "Admin",
      verified_at: nowIso,
      status_history: updatedHistory,
    };

    documents[docIndex] = updatedDoc;

    fs.writeFileSync(DATASET_PATH, JSON.stringify(documents, null, 2), "utf-8");
    return updatedDoc;
  } catch (error) {
    console.error(`[updateDocumentValidity] Error updating document ${id}:`, error);
    throw error;
  }
}

/**
 * Thống kê số lượng văn bản theo từng trạng thái hiệu lực
 */
export function getEffectiveStatusStats(): Record<string, number> {
  const docs = getAllDocuments();
  const stats: Record<string, number> = {
    active: 0,
    deadline_passed: 0,
    expired: 0,
    replaced: 0,
    unverified: 0,
    unknown: 0,
    total: docs.length,
  };

  for (const d of docs) {
    const st = d.effective_status || "unverified";
    if (stats[st] !== undefined) {
      stats[st] += 1;
    } else {
      stats["unverified"] += 1;
    }
  }

  return stats;
}


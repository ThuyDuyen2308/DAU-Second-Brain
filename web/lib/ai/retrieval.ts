import { Document } from "@/types/document";
import { RetrievedChunk, SourceReference } from "@/types/ask";
import { getAllDocuments } from "@/lib/documents";

// Danh sách từ dừng phổ biến trong câu hỏi tiếng Việt
const VI_STOPWORDS = new Set([
  "là", "gì", "như", "thế", "nào", "ở", "đâu", "khi", "bao", "giờ", "mấy",
  "ai", "sao", "có", "không", "cho", "của", "và", "các", "những", "được",
  "với", "về", "trong", "để", "ra", "đến", "từ", "này", "đó", "thì",
  "hãy", "xin", "hỏi", "biết", "cho", "em", "mình", "tôi", "nhé", "ạ",
  "muốn", "xem", "thông", "tin", "phải", "làm", "sinh", "viên",
  "trường", "đại", "học", "kiến", "trúc", "đà", "nẵng", "dau",
  "nhà", "nhiêu", "hiện", "tại", "năm", "cần", "hay", "tới", "lại",
  "hỗ", "trợ"
]);

const COMPOUND_PHRASES = [
  "học phí",
  "phúc khảo",
  "chuẩn đầu ra",
  "khảo sát",
  "bảo hiểm",
  "ngoại ngữ",
  "tin học",
  "quy đổi",
  "học kỳ 1",
  "học kỳ 2",
  "học kỳ i",
  "học kỳ ii",
  "khóa 2026",
  "toán học",
  "bài thi",
  "tiền học",
  "kỳ đầu",
  "thủ tục",
  "học bổng",
  "du học",
  "nhật bản",
  "ký túc xá",
  "hiệu trưởng",
  "điểm chuẩn"
];

/**
 * Chuẩn hóa và tách các từ khóa quan trọng từ câu hỏi
 */
export function extractKeywords(question: string): string[] {
  const normalized = question
    .toLowerCase()
    .replace(/[.,?!:;()\[\]"'/\\-]/g, " ")
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);
  const keywords: string[] = [];
  const foundCompounds: string[] = [];

  // 1. Giữ các cụm từ ghép đặc trưng quan trọng trước
  for (const phrase of COMPOUND_PHRASES) {
    if (normalized.includes(phrase) && !keywords.includes(phrase)) {
      keywords.push(phrase);
      foundCompounds.push(phrase);
    }
  }

  // 2. Giữ các cụm năm học dạng 2026-2027 hoặc 2026/2027
  const yearMatches = question.match(/\b(202\d[-/]?202\d|202\d)\b/g);
  if (yearMatches) {
    for (const ym of yearMatches) {
      const y = ym.toLowerCase();
      if (!keywords.includes(y)) keywords.push(y);
    }
  }

  // 3. Giữ các từ khóa đơn không nằm trong stopwords, không thuộc cụm từ ghép đã bắt
  for (const w of words) {
    if (
      w.length >= 2 &&
      !VI_STOPWORDS.has(w) &&
      !keywords.includes(w) &&
      !foundCompounds.some((cp) => cp.includes(w))
    ) {
      keywords.push(w);
    }
  }

  // Ánh xạ ngữ nghĩa cơ bản cho các cách diễn đạt phổ biến của sinh viên
  if (keywords.includes("tiền học") && !keywords.includes("học phí")) {
    keywords.push("học phí");
  }
  if (keywords.includes("kỳ đầu") && !keywords.includes("học kỳ 1")) {
    keywords.push("học kỳ 1");
    keywords.push("học kỳ i");
  }

  return keywords;
}

/**
 * Tính điểm relevance của một trang văn bản đối với danh sách từ khóa
 */
export function scorePageRelevance(
  doc: Document,
  pageNumber: number,
  pageText: string,
  keywords: string[]
): { score: number; matchedKeywords: string[] } {
  if (!keywords.length || !pageText.trim()) {
    return { score: 0, matchedKeywords: [] };
  }

  const textLower = pageText.toLowerCase();
  const titleLower = doc.title.toLowerCase();
  const categoryLower = (doc.category || "").toLowerCase();
  const subcategoryLower = (doc.subcategory || "").toLowerCase();
  const docNumberLower = (doc.document_number || "").toLowerCase();

  // Kiểm tra cụm từ chuyên biệt (Compound Phrases Gating) chống hallucination:
  // Nếu query có các cụm từ chuyên biệt mà văn bản không chứa bất kỳ cụm nào thì loại bỏ
  const queryCompounds = keywords.filter((k) => COMPOUND_PHRASES.includes(k));
  if (queryCompounds.length > 0) {
    const hasAnyCompound = queryCompounds.some(
      (cp) =>
        titleLower.includes(cp) ||
        categoryLower.includes(cp) ||
        subcategoryLower.includes(cp) ||
        docNumberLower.includes(cp) ||
        textLower.includes(cp)
    );
    if (!hasAnyCompound) {
      return { score: 0, matchedKeywords: [] };
    }
  }

  let score = 0;
  const matchedKeywords: string[] = [];

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    let kwMatched = false;

    // A. Khớp trong Số hiệu văn bản (+35)
    if (docNumberLower && docNumberLower.includes(kwLower)) {
      score += 35;
      kwMatched = true;
    }

    // B. Khớp trong Tiêu đề văn bản (Trọng số rất cao: +20)
    if (titleLower.includes(kwLower)) {
      score += 20;
      kwMatched = true;
    }

    // C. Khớp trong Danh mục / Phân nhóm (Trọng số cao: +15)
    if (categoryLower.includes(kwLower) || subcategoryLower.includes(kwLower)) {
      score += 15;
      kwMatched = true;
    }

    // D. Khớp trong Nội dung trang văn bản (+5 cho lần đầu, +1 cho các lần xuất hiện tiếp theo)
    if (textLower.includes(kwLower)) {
      const occurrences = (textLower.match(new RegExp(escapeRegExp(kwLower), "g")) || []).length;
      score += 5 + Math.min(occurrences - 1, 5); // Max thêm 5 điểm tần suất
      kwMatched = true;
    }

    if (kwMatched && !matchedKeywords.includes(kw)) {
      matchedKeywords.push(kw);
    }
  }

  if (matchedKeywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  // Tỷ lệ bao phủ từ khóa (Keyword Coverage Ratio)
  const coverageRatio = matchedKeywords.length / keywords.length;

  // Nếu câu hỏi có nhiều từ khóa (> 1) nhưng tỷ lệ bao phủ < 40%, loại bỏ để tránh suy diễn sai
  if (keywords.length > 1 && coverageRatio < 0.4) {
    return { score: 0, matchedKeywords: [] };
  }

  score = score * (0.5 + coverageRatio);

  return { score: Math.round(score * 10) / 10, matchedKeywords };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trích xuất đoạn văn (snippet) tiêu biểu chứa từ khóa
 */
export function extractSnippet(text: string, keywords: string[], maxLength = 240): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;

  // Tìm vị trí xuất hiện đầu tiên của bất kỳ từ khóa nào
  let firstIdx = -1;
  for (const kw of keywords) {
    const idx = clean.toLowerCase().indexOf(kw.toLowerCase());
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return clean.slice(0, maxLength) + "...";
  }

  const start = Math.max(0, firstIdx - 40);
  const end = Math.min(clean.length, start + maxLength);
  let snippet = clean.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < clean.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Tìm kiếm các đoạn/trang văn bản liên quan nhất từ kho dữ liệu
 */
export function retrieveRelevantChunks(
  question: string,
  minScoreThreshold = 15.0,
  maxChunks = 4
): RetrievedChunk[] {
  const allDocs = getAllDocuments();
  const keywords = extractKeywords(question);

  if (!keywords.length || !allDocs.length) {
    return [];
  }

  const chunks: RetrievedChunk[] = [];

  for (const doc of allDocs) {
    // Nếu doc có pages đã bóc tách OCR
    if (doc.pages && doc.pages.length > 0) {
      for (const page of doc.pages) {
        const pageText = (page.cleaned_text || page.raw_text || "").trim();
        if (!pageText) continue;

        const { score, matchedKeywords } = scorePageRelevance(
          doc,
          page.page_number,
          pageText,
          keywords
        );

        if (score >= minScoreThreshold) {
          chunks.push({
            documentId: doc.id,
            title: doc.title,
            documentNumber: doc.document_number,
            issueDate: doc.issue_date,
            category: doc.category,
            pageNumber: page.page_number,
            text: pageText,
            relevanceScore: score,
            matchedKeywords,
          });
        }
      }
    } else if (doc.content && doc.content.trim()) {
      // Fallback nếu doc chỉ có content gộp
      const { score, matchedKeywords } = scorePageRelevance(
        doc,
        1,
        doc.content,
        keywords
      );

      if (score >= minScoreThreshold) {
        chunks.push({
          documentId: doc.id,
          title: doc.title,
          documentNumber: doc.document_number,
          issueDate: doc.issue_date,
          category: doc.category,
          pageNumber: 1,
          text: doc.content,
          relevanceScore: score,
          matchedKeywords,
        });
      }
    }
  }

  // Sắp xếp giảm dần theo điểm relevanceScore
  chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return chunks.slice(0, maxChunks);
}

/**
 * Chuyển các chunk đã tìm kiếm thành danh sách nguồn trích dẫn SourceReference
 */
export function chunksToSources(chunks: RetrievedChunk[], allDocs: Document[]): SourceReference[] {
  const sources: SourceReference[] = [];
  const seenKey = new Set<string>();

  for (const chunk of chunks) {
    if (!chunk.documentId || chunk.documentId === "undefined") continue;

    // 1. Kiểm tra documentId có thực sự tồn tại trong dataset hay không (chống ID giả)
    const fullDoc = allDocs.find((d) => d.id === chunk.documentId);
    if (!fullDoc) {
      console.warn(`[chunksToSources] Bỏ qua documentId không tồn tại trong dataset: ${chunk.documentId}`);
      continue;
    }

    // 2. Kiểm tra tính hợp lệ của số trang (phải là số nguyên, trong phạm vi tổng số trang thật)
    const totalPages = fullDoc.total_pages || (fullDoc.pages ? fullDoc.pages.length : 1);
    let validPage = chunk.pageNumber;
    if (typeof validPage !== "number" || isNaN(validPage) || validPage < 1) {
      validPage = 1;
    }
    if (validPage > totalPages) {
      validPage = totalPages;
    }

    const key = `${fullDoc.id}_p${validPage}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    // 3. Xây dựng URL: chỉ gắn anchor #page-X nếu tài liệu có trang cụ thể
    const hasPages = fullDoc.pages && fullDoc.pages.length > 0;
    const citationUrl = hasPages
      ? `/documents/${fullDoc.id}#page-${validPage}`
      : `/documents/${fullDoc.id}`;

    sources.push({
      documentId: fullDoc.id,
      title: fullDoc.title,
      documentNumber: fullDoc.document_number,
      issueDate: fullDoc.issue_date,
      category: fullDoc.category,
      page: validPage,
      snippet: extractSnippet(chunk.text, chunk.matchedKeywords),
      url: citationUrl,
      sourceUrl: fullDoc.source_url || fullDoc.detail_url || null,
    });
  }

  return sources;
}

import { Document } from "@/types/document";

export interface TextChunk {
  chunkId: string;
  documentId: string;
  title: string;
  documentNumber: string | null;
  issueDate: string | null;
  category: string | null;
  pageNumber: number;
  text: string;
}

/**
 * Tách nội dung một trang văn bản thành các đoạn văn (paragraphs) phù hợp tiếng Việt.
 * Không cắt gãy giữa câu nếu không quá dài (khoảng 300 - 800 ký tự mỗi chunk).
 */
export function chunkPageText(
  doc: Document,
  pageNumber: number,
  pageText: string,
  maxChunkSize = 750,
  overlap = 100
): TextChunk[] {
  const clean = pageText.trim();
  if (!clean) return [];

  // Nếu trang tương đối ngắn (<= maxChunkSize), giữ nguyên 1 chunk để bảo toàn ngữ cảnh
  if (clean.length <= maxChunkSize) {
    return [
      {
        chunkId: `${doc.id}_p${pageNumber}_c1`,
        documentId: doc.id,
        title: doc.title,
        documentNumber: doc.document_number,
        issueDate: doc.issue_date,
        category: doc.category,
        pageNumber,
        text: clean,
      },
    ];
  }

  // Tách theo đoạn văn trước (\n\n hoặc \n)
  const paragraphs = clean
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let currentText = "";
  let chunkIndex = 1;

  for (const para of paragraphs) {
    if ((currentText + "\n\n" + para).length <= maxChunkSize) {
      currentText = currentText ? `${currentText}\n\n${para}` : para;
    } else {
      if (currentText) {
        chunks.push({
          chunkId: `${doc.id}_p${pageNumber}_c${chunkIndex++}`,
          documentId: doc.id,
          title: doc.title,
          documentNumber: doc.document_number,
          issueDate: doc.issue_date,
          category: doc.category,
          pageNumber,
          text: currentText.trim(),
        });
      }

      // Nếu bản thân một đoạn văn dài hơn maxChunkSize, tách theo câu (. ! ?)
      if (para.length > maxChunkSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sentAccum = "";
        for (const sent of sentences) {
          if ((sentAccum + " " + sent).length <= maxChunkSize) {
            sentAccum = sentAccum ? `${sentAccum} ${sent}` : sent;
          } else {
            if (sentAccum) {
              chunks.push({
                chunkId: `${doc.id}_p${pageNumber}_c${chunkIndex++}`,
                documentId: doc.id,
                title: doc.title,
                documentNumber: doc.document_number,
                issueDate: doc.issue_date,
                category: doc.category,
                pageNumber,
                text: sentAccum.trim(),
              });
            }
            sentAccum = sent;
          }
        }
        currentText = sentAccum;
      } else {
        currentText = para;
      }
    }
  }

  if (currentText.trim()) {
    chunks.push({
      chunkId: `${doc.id}_p${pageNumber}_c${chunkIndex}`,
      documentId: doc.id,
      title: doc.title,
      documentNumber: doc.document_number,
      issueDate: doc.issue_date,
      category: doc.category,
      pageNumber,
      text: currentText.trim(),
    });
  }

  return chunks;
}

/**
 * Tạo danh sách toàn bộ các text chunks từ danh sách Document
 */
export function createChunksFromDocuments(documents: Document[]): TextChunk[] {
  const allChunks: TextChunk[] = [];

  for (const doc of documents) {
    if (doc.pages && doc.pages.length > 0) {
      for (const page of doc.pages) {
        const text = (page.cleaned_text || page.raw_text || "").trim();
        if (!text) continue;
        const pageChunks = chunkPageText(doc, page.page_number, text);
        allChunks.push(...pageChunks);
      }
    } else if (doc.content && doc.content.trim()) {
      const pageChunks = chunkPageText(doc, 1, doc.content);
      allChunks.push(...pageChunks);
    }
  }

  return allChunks;
}

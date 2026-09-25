import fs from "fs";
import path from "path";
import { EmbeddedChunkItem, EmbeddingIndex } from "@/types/ask";
import { createChunksFromDocuments } from "./chunking";
import { getAvailableEmbeddingProvider, IEmbeddingProvider } from "./embedding_provider";
import { getAllDocuments } from "@/lib/documents";

// Đường dẫn lưu trữ local file vector index
export const EMBEDDING_INDEX_PATH = path.resolve(
  process.cwd(),
  "data/embeddings/index.json"
);

/**
 * Đọc vector index đã lưu từ ổ đĩa
 */
export function loadEmbeddingIndex(): EmbeddingIndex | null {
  try {
    if (!fs.existsSync(EMBEDDING_INDEX_PATH)) {
      return null;
    }
    const content = fs.readFileSync(EMBEDDING_INDEX_PATH, "utf-8");
    const parsed: EmbeddingIndex = JSON.parse(content);
    if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("[loadEmbeddingIndex] Không thể đọc index cache:", err);
    return null;
  }
}

/**
 * Lưu vector index ra file local json
 */
export function saveEmbeddingIndex(index: EmbeddingIndex): boolean {
  try {
    const dir = path.dirname(EMBEDDING_INDEX_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(EMBEDDING_INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("[saveEmbeddingIndex] Lỗi lưu index:", err);
    return false;
  }
}

/**
 * Tạo mới hoặc cập nhật Embedding Index từ toàn bộ dataset
 */
export async function buildEmbeddingIndex(
  customProvider?: IEmbeddingProvider
): Promise<{ success: boolean; message: string; totalChunks?: number }> {
  const provider = customProvider || getAvailableEmbeddingProvider();

  if (!provider || !provider.isAvailable()) {
    return {
      success: false,
      message:
        "Embedding provider is not configured. No embedding index was generated. Keyword retrieval remains available.",
    };
  }

  const allDocs = getAllDocuments();
  if (!allDocs.length) {
    return {
      success: false,
      message: "Không tìm thấy dữ liệu văn bản để tạo embedding.",
    };
  }

  const textChunks = createChunksFromDocuments(allDocs);
  console.log(`[buildEmbeddingIndex] Đang tạo embedding cho ${textChunks.length} chunks sử dụng ${provider.name}...`);

  const embeddedChunks: EmbeddedChunkItem[] = [];

  // Tạo embedding tuần tự hoặc theo batch
  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    // Ghép metadata vào text embedding để tối ưu ngữ nghĩa
    const contentToEmbed = `Tài liệu: ${chunk.title}. ${chunk.category ? `Chủ đề: ${chunk.category}. ` : ""}Trang: ${chunk.pageNumber}.\nNội dung: ${chunk.text}`;

    try {
      const vector = await provider.embedText(contentToEmbed);
      embeddedChunks.push({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        title: chunk.title,
        documentNumber: chunk.documentNumber,
        issueDate: chunk.issueDate,
        category: chunk.category,
        pageNumber: chunk.pageNumber,
        text: chunk.text,
        embedding: vector,
      });
    } catch (err) {
      console.error(`[buildEmbeddingIndex] Lỗi tạo embedding chunk ${chunk.chunkId}:`, err);
    }
  }

  const indexData: EmbeddingIndex = {
    model: provider.name,
    createdAt: new Date().toISOString(),
    totalChunks: embeddedChunks.length,
    chunks: embeddedChunks,
  };

  const saved = saveEmbeddingIndex(indexData);
  if (!saved) {
    return {
      success: false,
      message: "Tạo vector thành công nhưng không thể lưu file index.",
    };
  }

  return {
    success: true,
    message: `Đã tạo và lưu thành công ${embeddedChunks.length} vector embeddings vào ${EMBEDDING_INDEX_PATH}.`,
    totalChunks: embeddedChunks.length,
  };
}

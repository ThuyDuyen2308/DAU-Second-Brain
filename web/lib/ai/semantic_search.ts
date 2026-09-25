import { RetrievedChunk } from "@/types/ask";
import { cosineSimilarity, getAvailableEmbeddingProvider, IEmbeddingProvider } from "./embedding_provider";
import { loadEmbeddingIndex } from "./embedding_cache";

/**
 * Tìm kiếm theo ngữ nghĩa (Semantic Search) sử dụng Vector Embedding
 */
export async function performSemanticSearch(
  question: string,
  minSimilarity = 0.55,
  maxChunks = 4,
  customProvider?: IEmbeddingProvider
): Promise<RetrievedChunk[]> {
  const index = loadEmbeddingIndex();
  if (!index || !index.chunks || !index.chunks.length) {
    return [];
  }

  const provider = customProvider || getAvailableEmbeddingProvider();
  if (!provider || !provider.isAvailable()) {
    return [];
  }

  let queryVector: number[];
  try {
    queryVector = await provider.embedText(question);
  } catch (err) {
    console.warn("[performSemanticSearch] Không thể tạo embedding cho câu hỏi:", err);
    return [];
  }

  const scoredChunks: Array<{ chunk: typeof index.chunks[0]; sim: number }> = [];

  for (const chunk of index.chunks) {
    if (!chunk.embedding || !chunk.embedding.length) continue;
    const sim = cosineSimilarity(queryVector, chunk.embedding);
    if (sim >= minSimilarity) {
      scoredChunks.push({ chunk, sim });
    }
  }

  // Sắp xếp tương đồng ngữ nghĩa từ cao xuống thấp
  scoredChunks.sort((a, b) => b.sim - a.sim);

  return scoredChunks.slice(0, maxChunks).map(({ chunk, sim }) => ({
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    documentNumber: chunk.documentNumber,
    issueDate: chunk.issueDate,
    category: chunk.category,
    pageNumber: chunk.pageNumber,
    text: chunk.text,
    relevanceScore: Math.round(sim * 100 * 10) / 10,
    semanticScore: Math.round(sim * 1000) / 1000,
    matchedKeywords: ["semantic_match"],
  }));
}

import { RetrievedChunk } from "@/types/ask";
import { retrieveRelevantChunks } from "./retrieval";
import { performSemanticSearch } from "./semantic_search";
import { IEmbeddingProvider } from "./embedding_provider";

export interface HybridRetrievalOptions {
  keywordWeight?: number; // Mặc định: 0.4
  semanticWeight?: number; // Mặc định: 0.6
  maxChunks?: number;
  minFinalScore?: number;
  customEmbeddingProvider?: IEmbeddingProvider;
}

/**
 * Thuật toán Hybrid Retrieval kết hợp Keyword Search + Semantic Search
 * Giữ nguyên độ nhạy chính xác của số hiệu văn bản/năm học và bổ sung hiểu ngữ nghĩa sâu.
 */
export async function hybridRetrieveChunks(
  question: string,
  options: HybridRetrievalOptions = {}
): Promise<{ chunks: RetrievedChunk[]; isHybrid: boolean }> {
  const {
    keywordWeight = 0.4,
    semanticWeight = 0.6,
    maxChunks = 4,
    minFinalScore = 15.0,
    customEmbeddingProvider,
  } = options;

  // 1. Thực hiện Keyword Retrieval (Bước 8 - luôn sẵn sàng)
  const keywordChunks = retrieveRelevantChunks(question, 8.0, maxChunks * 2);

  // 2. Thử thực hiện Semantic Search
  let semanticChunks: RetrievedChunk[] = [];
  try {
    semanticChunks = await performSemanticSearch(
      question,
      0.55,
      maxChunks * 2,
      customEmbeddingProvider
    );
  } catch (err) {
    console.warn("[hybridRetrieveChunks] Semantic search fallback to keyword:", err);
  }

  // 3. Nếu không có Semantic Search (chưa có index hoặc API key), fallback hoàn toàn sang Keyword Search
  if (!semanticChunks.length) {
    const formatted = keywordChunks.slice(0, maxChunks).map((c) => ({
      ...c,
      keywordScore: c.relevanceScore,
      finalScore: c.relevanceScore,
    }));
    return { chunks: formatted, isHybrid: false };
  }

  // 4. Hợp nhất (Hybrid Fusion & Ranking)
  const chunkMap = new Map<
    string,
    {
      chunk: RetrievedChunk;
      keywordScore: number;
      semanticScore: number;
    }
  >();

  // Chuẩn hóa điểm Keyword về thang [0, 100]
  const maxKw = Math.max(...keywordChunks.map((c) => c.relevanceScore), 1);

  for (const kc of keywordChunks) {
    const key = `${kc.documentId}_p${kc.pageNumber}`;
    const normKw = (kc.relevanceScore / maxKw) * 100;
    chunkMap.set(key, {
      chunk: kc,
      keywordScore: kc.relevanceScore,
      semanticScore: 0,
    });
  }

  for (const sc of semanticChunks) {
    const key = `${sc.documentId}_p${sc.pageNumber}`;
    const semScore = sc.semanticScore || (sc.relevanceScore / 100);
    const existing = chunkMap.get(key);

    if (existing) {
      existing.semanticScore = semScore;
    } else {
      chunkMap.set(key, {
        chunk: sc,
        keywordScore: 0,
        semanticScore: semScore,
      });
    }
  }

  // Tính điểm tổng hợp finalScore:
  // Nếu có từ khóa số hiệu chính xác (như 34/TB-ĐHKTĐN, 2026-2027), keywordScore sẽ rất cao
  const rankedResults: RetrievedChunk[] = [];

  for (const [, item] of chunkMap.entries()) {
    const normKw = item.keywordScore > 0 ? (item.keywordScore / maxKw) * 100 : 0;
    const normSem = item.semanticScore * 100;

    const finalScore = normKw * keywordWeight + normSem * semanticWeight;

    if (finalScore >= minFinalScore || item.keywordScore >= 30) {
      rankedResults.push({
        ...item.chunk,
        relevanceScore: Math.round(finalScore * 10) / 10,
        keywordScore: item.keywordScore,
        semanticScore: item.semanticScore,
        finalScore: Math.round(finalScore * 10) / 10,
      });
    }
  }

  rankedResults.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  return {
    chunks: rankedResults.slice(0, maxChunks),
    isHybrid: true,
  };
}

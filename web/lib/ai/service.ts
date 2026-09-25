// web/lib/ai/service.ts
import { chunksToSources } from "@/lib/ai/retrieval";
import { hybridRetrieveChunks } from "@/lib/ai/hybrid_retrieval";
import { buildContextFromChunks } from "@/lib/ai/context_builder";
import { callAIModel } from "@/lib/ai/provider";
import { getAllDocuments } from "@/lib/documents";
import { AskResponse } from "@/types/ask";

/**
 * Thực thi toàn bộ quy trình RAG Pipeline chính thức của DAU Second Brain:
 * Câu hỏi -> Hybrid Retrieval -> Context Builder -> AI Model/Synthesizer -> Trích dẫn & Trả lời.
 */
export async function runRagPipeline(rawQuestion: string): Promise<AskResponse> {
  const allDocs = getAllDocuments();
  const { chunks, isHybrid } = await hybridRetrieveChunks(rawQuestion, {
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    maxChunks: 4,
    minFinalScore: 8.0,
  });
  const sources = chunksToSources(chunks, allDocs);

  if (!chunks.length || !sources.length) {
    return {
      answer: "Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU.",
      sources: [],
      relevantDocumentsFound: 0,
    };
  }

  const context = buildContextFromChunks(chunks);
  const aiResult = await callAIModel(rawQuestion, context, chunks, sources);

  return {
    answer: aiResult.answer,
    sources: sources,
    relevantDocumentsFound: sources.length,
    modelUsed: `${aiResult.modelUsed} (${isHybrid ? "Hybrid Retrieval" : "Keyword Fallback"})`,
  };
}
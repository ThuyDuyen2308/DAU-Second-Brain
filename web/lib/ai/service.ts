// web/lib/ai/service.ts
import { chunksToSources, extractKeywords } from "@/lib/ai/retrieval";
import { hybridRetrieveChunks } from "@/lib/ai/hybrid_retrieval";
import { buildContextFromChunks } from "@/lib/ai/context_builder";
import { callAIModel } from "@/lib/ai/provider";
import { getAllDocuments } from "@/lib/documents";
import { AskResponse } from "@/types/ask";

/**
 * Thực thi toàn bộ quy trình RAG Pipeline chính thức của DAU Second Brain:
 * Câu hỏi -> Query Guard -> Hybrid Retrieval -> Context Builder -> AI Model/Synthesizer -> Trích dẫn & Trả lời.
 */
export async function runRagPipeline(rawQuestion: string): Promise<AskResponse> {
  const normalizedQ = rawQuestion.toLowerCase().trim();

  // 1. Kiểm tra câu hỏi về thông tin cá nhân / ngữ cảnh người dùng
  const isPersonalInfoQuery =
    /\b(tôi|em|mình|ta)\s+(tên|là\s+ai|học\s+lớp|sinh\s+năm|ở\s+đâu|quê\s+ở|vừa\s+hỏi|mấy\s+tuổi)\b/i.test(normalizedQ) ||
    /^(tôi tên gì|tôi là ai|tôi vừa hỏi gì|tên của tôi|tên tôi là gì|tôi học lớp nào|ai là người hỏi)\b/i.test(normalizedQ);

  if (isPersonalInfoQuery) {
    return {
      answer: "Tôi là trợ lý AI tra cứu văn bản và quy định của Trường Đại học Kiến trúc Đà Nẵng (DAU). Hệ thống không lưu trữ thông tin cá nhân của bạn nên không thể biết bạn tên gì hay là ai. Bạn có thể hỏi tôi về các thông báo, quy chế đào tạo, học phí, khảo sát hoặc các quy định của nhà trường!",
      sources: [],
      relevantDocumentsFound: 0,
      modelUsed: "DAU Personal Guard (No user data stored)",
    };
  }

  // 2. Kiểm tra câu hỏi chào hỏi xã giao
  const isGreetingQuery =
    /^(chào\s*(bạn|ai|bot|em|ad|admin)?|xin chào|hello|hi|hey|alo|cảm ơn\s*(bạn|bot)?|tạm biệt|bye)\s*[!?.]*$/i.test(normalizedQ);

  if (isGreetingQuery) {
    return {
      answer: "Xin chào! Tôi là Trợ lý AI tra cứu thông tin và văn bản của Trường Đại học Kiến trúc Đà Nẵng (DAU). Bạn cần tra cứu thông báo, học phí, khảo sát, chuẩn đầu ra hay quy chế đào tạo nào của trường?",
      sources: [],
      relevantDocumentsFound: 0,
      modelUsed: "DAU Greeting Guard",
    };
  }

  // 3. Kiểm tra từ khóa tên miền hợp lệ
  const keywords = extractKeywords(rawQuestion);
  if (!keywords.length) {
    return {
      answer: "Không tìm thấy thông tin liên quan trong kho tài liệu DAU. Vui lòng đặt câu hỏi cụ thể hơn về các quy định, thông báo, học phí, khảo sát hoặc quy chế đào tạo của nhà trường.",
      sources: [],
      relevantDocumentsFound: 0,
      modelUsed: "DAU Guard (No domain keywords)",
    };
  }

  // 4. Hybrid Retrieval với ngưỡng relevance nghiêm ngặt
  const allDocs = getAllDocuments();
  const { chunks, isHybrid } = await hybridRetrieveChunks(rawQuestion, {
    keywordWeight: 0.4,
    semanticWeight: 0.6,
    maxChunks: 4,
    minFinalScore: 20.0,
  });
  const sources = chunksToSources(chunks, allDocs);

  // 5. Nếu không có văn bản nào vượt qua ngưỡng liên quan -> Báo không tìm thấy, tuyệt đối không đưa context rác
  if (!chunks.length || !sources.length) {
    return {
      answer: "Không tìm thấy thông tin liên quan trong kho tài liệu DAU. Vui lòng đặt câu hỏi cụ thể hơn về các quy định, thông báo, học phí, khảo sát hoặc quy chế đào tạo của nhà trường.",
      sources: [],
      relevantDocumentsFound: 0,
      modelUsed: "DAU Guard (No relevant documents)",
    };
  }

  // 6. Xây dựng context và gọi AI Model
  const context = buildContextFromChunks(chunks);
  const aiResult = await callAIModel(rawQuestion, context, chunks, sources);

  return {
    answer: aiResult.answer,
    sources: sources,
    relevantDocumentsFound: sources.length,
    modelUsed: `${aiResult.modelUsed} (${isHybrid ? "Hybrid Retrieval" : "Keyword Fallback"})`,
  };
}
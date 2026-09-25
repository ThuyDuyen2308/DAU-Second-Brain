import { NextRequest, NextResponse } from "next/server";
import { chunksToSources } from "@/lib/ai/retrieval";
import { hybridRetrieveChunks } from "@/lib/ai/hybrid_retrieval";
import { buildContextFromChunks } from "@/lib/ai/context_builder";
import { callAIModel } from "@/lib/ai/provider";
import { getAllDocuments } from "@/lib/documents";
import { AskRequest, AskResponse } from "@/types/ask";

export async function POST(req: NextRequest) {
  try {
    const body: AskRequest = await req.json().catch(() => ({ question: "" }));
    const rawQuestion = (body.question || "").trim();

    // 1. Validation câu hỏi
    if (!rawQuestion) {
      return NextResponse.json(
        { error: "Câu hỏi không được để trống." },
        { status: 400 }
      );
    }

    if (rawQuestion.length > 500) {
      return NextResponse.json(
        { error: "Câu hỏi quá dài (tối đa 500 ký tự). Vui lòng rút gọn câu hỏi và thử lại." },
        { status: 400 }
      );
    }

    // 2. Tìm kiếm văn bản bằng HYBRID RETRIEVAL (Keyword + Semantic Search)
    const allDocs = getAllDocuments();
    const { chunks, isHybrid } = await hybridRetrieveChunks(rawQuestion, {
      keywordWeight: 0.4,
      semanticWeight: 0.6,
      maxChunks: 4,
      minFinalScore: 8.0,
    });
    const sources = chunksToSources(chunks, allDocs);

    // 3. Nếu không tìm thấy văn bản phù hợp trong kho dữ liệu
    if (!chunks.length || !sources.length) {
      const responseData: AskResponse = {
        answer: "Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU.",
        sources: [],
        relevantDocumentsFound: 0,
      };
      return NextResponse.json(responseData);
    }

    // 4. Xây dựng Context kèm metadata số trang rõ ràng
    const context = buildContextFromChunks(chunks);

    // 5. Gọi AI Model (hoặc Extractive synthesizer nếu chưa có key)
    const aiResult = await callAIModel(rawQuestion, context, chunks, sources);

    // 6. Trả lời kèm nguồn trích dẫn
    const responseData: AskResponse = {
      answer: aiResult.answer,
      sources: sources,
      relevantDocumentsFound: sources.length,
      modelUsed: `${aiResult.modelUsed} (${isHybrid ? "Hybrid Retrieval" : "Keyword Fallback"})`,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    console.error("[POST /api/ask Error]", err);
    return NextResponse.json(
      { error: "Không thể kết nối với trợ lý AI lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

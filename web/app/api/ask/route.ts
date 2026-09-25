// web/app/api/ask/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runRagPipeline } from "@/lib/ai/service";
import { AskRequest } from "@/types/ask";

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

    // 2. Chạy RAG Pipeline chính thức
    const responseData = await runRagPipeline(rawQuestion);
    return NextResponse.json(responseData);
  } catch (err) {
    console.error("[POST /api/ask Error]", err);
    return NextResponse.json(
      { error: "Không thể kết nối với trợ lý AI lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
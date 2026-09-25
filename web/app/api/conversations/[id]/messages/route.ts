// web/app/api/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { AuthUser } from "@/lib/auth/types";
import { runRagPipeline } from "@/lib/ai/service";
import { ChatCitation, ChatMessage, ChatRole } from "@/types/ask";

async function resolveDbUserId(authUser: AuthUser): Promise<string> {
  const byId = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (byId) return byId.id;

  const byEmail = await prisma.user.findUnique({ where: { email: authUser.email.toLowerCase() } });
  if (byEmail) return byEmail.id;

  return authUser.id;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để gửi tin nhắn." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rawQuestion = (body.content || body.question || "").trim();

    if (!rawQuestion) {
      return NextResponse.json(
        { error: "Nội dung câu hỏi không được để trống." },
        { status: 400 }
      );
    }

    if (rawQuestion.length > 500) {
      return NextResponse.json(
        { error: "Câu hỏi quá dài (tối đa 500 ký tự). Vui lòng rút gọn và thử lại." },
        { status: 400 }
      );
    }

    const dbUserId = await resolveDbUserId(user);

    // 1. Kiểm tra conversation tồn tại và thuộc quyền sở hữu của user
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: true },
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    if (conv.userId !== dbUserId) {
      return NextResponse.json(
        { error: "Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này." },
        { status: 403 }
      );
    }

    // 2. Lưu tin nhắn của User vào database
    const userDbMsg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: "USER",
        content: rawQuestion,
      },
    });

    // 3. Thực thi RAG Pipeline chính thức (Retrieval -> Context Builder -> AI Model -> Citation)
    const ragResult = await runRagPipeline(rawQuestion);

    // Chuẩn hóa cấu trúc citations để lưu database và trả về client
    const citations: ChatCitation[] = ragResult.sources.map((s) => ({
      documentId: s.documentId,
      title: s.title,
      documentNumber: s.documentNumber,
      pageNumber: s.page,
      snippet: s.snippet,
      url: s.url,
    }));

    // 4. Lưu câu trả lời của AI và citations thực tế vào database
    const assistantDbMsg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        role: "ASSISTANT",
        content: ragResult.answer,
        citations: citations as any,
        modelUsed: ragResult.modelUsed,
      },
    });

    // 5. Cập nhật thời điểm updatedAt của cuộc trò chuyện
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    const userMessage: ChatMessage = {
      id: userDbMsg.id,
      role: "user",
      content: userDbMsg.content,
      createdAt: userDbMsg.createdAt.toISOString(),
    };

    const assistantMessage: ChatMessage = {
      id: assistantDbMsg.id,
      role: "assistant",
      content: assistantDbMsg.content,
      createdAt: assistantDbMsg.createdAt.toISOString(),
      modelUsed: assistantDbMsg.modelUsed || undefined,
      citations,
    };

    return NextResponse.json({
      userMessage,
      assistantMessage,
      sources: ragResult.sources,
    });
  } catch (error) {
    console.error("[POST /api/conversations/[id]/messages Error]", error);
    return NextResponse.json(
      { error: "Không thể xử lý tin nhắn lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
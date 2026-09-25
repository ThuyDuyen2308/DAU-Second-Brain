// web/app/api/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { AuthUser } from "@/lib/auth/types";
import { ChatRole, Conversation } from "@/types/ask";

/**
 * Đảm bảo lấy đúng ID người dùng trong PostgreSQL (kể cả khi session được tạo từ demo fallback)
 */
async function resolveDbUserId(authUser: AuthUser): Promise<string> {
  const byId = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (byId) return byId.id;

  const byEmail = await prisma.user.findUnique({ where: { email: authUser.email.toLowerCase() } });
  if (byEmail) return byEmail.id;

  const created = await prisma.user.create({
    data: {
      name: authUser.name,
      email: authUser.email.toLowerCase(),
      passwordHash: "$2a$12$demo_placeholder_password_hash_for_session_compatibility",
      role: authUser.role === "admin" ? "ADMIN" : "STUDENT",
    },
  });
  return created.id;
}

// 1. GET /api/conversations - Liệt kê tất cả cuộc trò chuyện của người dùng hiện tại
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem lịch sử cuộc trò chuyện." },
        { status: 401 }
      );
    }

    const dbUserId = await resolveDbUserId(user);

    const conversations = await prisma.conversation.findMany({
      where: { userId: dbUserId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const formatted: Conversation[] = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role.toLowerCase() as ChatRole,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        citations: (m.citations as any) || [],
        modelUsed: m.modelUsed || undefined,
      })),
    }));

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    console.error("[GET /api/conversations Error]", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách cuộc trò chuyện lúc này." },
      { status: 500 }
    );
  }
}

// 2. POST /api/conversations - Tạo một cuộc trò chuyện mới
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để tạo cuộc trò chuyện." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    const title = rawTitle.length > 0 ? rawTitle.slice(0, 100) : "Cuộc trò chuyện mới";

    const dbUserId = await resolveDbUserId(user);

    const newConv = await prisma.conversation.create({
      data: {
        userId: dbUserId,
        title,
      },
      include: {
        messages: true,
      },
    });

    const formatted: Conversation = {
      id: newConv.id,
      title: newConv.title,
      createdAt: newConv.createdAt.toISOString(),
      updatedAt: newConv.updatedAt.toISOString(),
      messages: [],
    };

    return NextResponse.json({ conversation: formatted }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/conversations Error]", error);
    return NextResponse.json(
      { error: "Không thể tạo cuộc trò chuyện lúc này." },
      { status: 500 }
    );
  }
}
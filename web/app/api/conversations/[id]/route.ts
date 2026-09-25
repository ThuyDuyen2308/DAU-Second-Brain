// web/app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { AuthUser } from "@/lib/auth/types";
import { ChatRole, Conversation } from "@/types/ask";

async function resolveDbUserId(authUser: AuthUser): Promise<string> {
  const byId = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (byId) return byId.id;

  const byEmail = await prisma.user.findUnique({ where: { email: authUser.email.toLowerCase() } });
  if (byEmail) return byEmail.id;

  return authUser.id;
}

// 1. GET /api/conversations/[id] - Lấy chi tiết cuộc trò chuyện và tin nhắn
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem cuộc trò chuyện này." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const dbUserId = await resolveDbUserId(user);

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    // Bảo vệ phân quyền dữ liệu: Không cho User A xem cuộc trò chuyện của User B
    if (conv.userId !== dbUserId) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập vào cuộc trò chuyện này." },
        { status: 403 }
      );
    }

    const formatted: Conversation = {
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
    };

    return NextResponse.json({ conversation: formatted });
  } catch (error) {
    console.error("[GET /api/conversations/[id] Error]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi tải cuộc trò chuyện." },
      { status: 500 }
    );
  }
}

// 2. PATCH /api/conversations/[id] - Đổi tên cuộc trò chuyện
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đổi tên cuộc trò chuyện." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";

    if (!rawTitle) {
      return NextResponse.json(
        { error: "Tiêu đề cuộc trò chuyện không được để trống." },
        { status: 400 }
      );
    }

    const dbUserId = await resolveDbUserId(user);

    const conv = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện." },
        { status: 404 }
      );
    }

    // Kiểm tra quyền sở hữu
    if (conv.userId !== dbUserId) {
      return NextResponse.json(
        { error: "Bạn không có quyền đổi tên cuộc trò chuyện này." },
        { status: 403 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        title: rawTitle.slice(0, 100),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đã đổi tên cuộc trò chuyện thành công.",
      conversation: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[PATCH /api/conversations/[id] Error]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi đổi tên cuộc trò chuyện." },
      { status: 500 }
    );
  }
}

// 3. DELETE /api/conversations/[id] - Xóa cuộc trò chuyện và các tin nhắn liên quan
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xóa cuộc trò chuyện." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const dbUserId = await resolveDbUserId(user);

    const conv = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Không tìm thấy cuộc trò chuyện để xóa." },
        { status: 404 }
      );
    }

    // Kiểm tra quyền sở hữu
    if (conv.userId !== dbUserId) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa cuộc trò chuyện này." },
        { status: 403 }
      );
    }

    // Xóa cuộc trò chuyện (quan hệ Cascade trong schema.prisma sẽ tự động xóa sạch các tin nhắn messages liên quan)
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Đã xóa cuộc trò chuyện thành công.",
    });
  } catch (error) {
    console.error("[DELETE /api/conversations/[id] Error]", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ khi xóa cuộc trò chuyện." },
      { status: 500 }
    );
  }
}
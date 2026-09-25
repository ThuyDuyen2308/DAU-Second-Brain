// web/app/api/admin/import/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const document = await prisma.importedDocument.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu import." }, { status: 404 });
    }

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error("[GET /api/admin/import/[id] Error]", error);
    return NextResponse.json({ error: "Lỗi máy chủ: " + error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Dữ liệu payload không hợp lệ." }, { status: 400 });
    }

    const existing = await prisma.importedDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu import." }, { status: 404 });
    }

    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Tài liệu đã được công bố (Published), không thể sửa đổi qua hàng đợi." },
        { status: 400 }
      );
    }

    // Cập nhật editedMetadata do Admin hiệu chỉnh
    const updated = await prisma.importedDocument.update({
      where: { id },
      data: {
        editedMetadata: body.editedMetadata || body,
      },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error: any) {
    console.error("[PATCH /api/admin/import/[id] Error]", error);
    return NextResponse.json({ error: "Lỗi máy chủ: " + error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.importedDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }

    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Không thể xóa tài liệu đã được công bố vào kho RAG từ hàng đợi này." },
        { status: 400 }
      );
    }

    // Xóa file vật lý qua storage adapter
    try {
      const storage = getStorageAdapter();
      await storage.delete(existing.storagePath);
    } catch (storageErr) {
      console.warn(`[Delete warning] Không thể xóa file vật lý ${existing.storagePath}:`, storageErr);
    }

    // Xóa record trong database
    await prisma.importedDocument.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Đã xóa tài liệu khỏi hàng đợi." });
  } catch (error: any) {
    console.error("[DELETE /api/admin/import/[id] Error]", error);
    return NextResponse.json({ error: "Lỗi máy chủ: " + error.message }, { status: 500 });
  }
}
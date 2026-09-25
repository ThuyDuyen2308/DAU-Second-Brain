// web/app/api/admin/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { ImportStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: Vui lòng đăng nhập." }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Chỉ quản trị viên mới có quyền xem hàng đợi tài liệu." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as ImportStatus | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Điều kiện tìm kiếm
    const whereClause: any = {};
    if (statusFilter && Object.values(ImportStatus).includes(statusFilter)) {
      whereClause.status = statusFilter;
    }

    // Đếm thống kê theo từng trạng thái
    const [
      totalPending,
      totalProcessing,
      totalProcessed,
      totalFailed,
      totalPublished,
      totalDuplicate,
      totalItems,
      documents,
    ] = await Promise.all([
      prisma.importedDocument.count({ where: { status: "PENDING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSING" } }),
      prisma.importedDocument.count({ where: { status: "PROCESSED" } }),
      prisma.importedDocument.count({ where: { status: "FAILED" } }),
      prisma.importedDocument.count({ where: { status: "PUBLISHED" } }),
      prisma.importedDocument.count({ where: { status: "DUPLICATE" } }),
      prisma.importedDocument.count({ where: whereClause }),
      prisma.importedDocument.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          originalName: true,
          storagePath: true,
          mimeType: true,
          fileFormat: true,
          sizeBytes: true,
          checksum: true,
          status: true,
          errorMessage: true,
          retryCount: true,
          documentId: true,
          processedAt: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          uploadedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        pending: totalPending,
        processing: totalProcessing,
        processed: totalProcessed,
        failed: totalFailed,
        published: totalPublished,
        duplicate: totalDuplicate,
        total: totalPending + totalProcessing + totalProcessed + totalFailed + totalPublished + totalDuplicate,
      },
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
      documents,
    });
  } catch (error: any) {
    console.error("[GET /api/admin/import Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi lấy danh sách tài liệu import: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
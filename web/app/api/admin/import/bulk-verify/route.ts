// web/app/api/admin/import/bulk-verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Chỉ quản trị viên mới có quyền xác minh tài liệu." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 tài liệu để xác minh." },
        { status: 400 }
      );
    }

    const documents = await prisma.importedDocument.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        originalName: true,
        status: true,
        editedMetadata: true,
        extractedJson: true,
      },
    });

    const nowIso = new Date().toISOString();
    const verifier = user.email || user.name || "Admin";

    let successCount = 0;
    let failCount = 0;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const doc of documents) {
      try {
        const existingEdited = (doc.editedMetadata as any) || {};
        const extJson = (doc.extractedJson as any) || {};
        const hints = extJson.metadata_hints || {};
        const validity = extJson.validity_analysis || {};

        // Cập nhật thông tin xác minh mà tuyệt đối KHÔNG tự ý Publish
        const updatedMetadata = {
          ...existingEdited,
          title: existingEdited.title || hints.title_candidate || doc.originalName,
          document_number:
            existingEdited.document_number !== undefined
              ? existingEdited.document_number
              : hints.document_number || "",
          issue_date:
            existingEdited.issue_date !== undefined
              ? existingEdited.issue_date
              : hints.issue_date || validity.issue_date || "",
          issuing_unit:
            existingEdited.issuing_unit !== undefined
              ? existingEdited.issuing_unit
              : hints.issuing_unit || "Trường Đại học Kiến trúc Đà Nẵng",
          category:
            existingEdited.category !== undefined
              ? existingEdited.category
              : hints.category_hint || "Thông báo",
          effective_status:
            existingEdited.effective_status !== undefined
              ? existingEdited.effective_status
              : validity.suggested_status || "unverified",
          status_evidence:
            existingEdited.status_evidence !== undefined
              ? existingEdited.status_evidence
              : validity.status_evidence || "",
          is_verified: true,
          verified_by: verifier,
          verified_at: nowIso,
        };

        await prisma.importedDocument.update({
          where: { id: doc.id },
          data: {
            editedMetadata: updatedMetadata,
          },
        });

        successCount++;
        results.push({ id: doc.id, success: true });
      } catch (err: any) {
        failCount++;
        results.push({ id: doc.id, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã xác minh thành công ${successCount} tài liệu (${failCount} lỗi).`,
      verifiedCount: successCount,
      failedCount: failCount,
      verifiedBy: verifier,
      verifiedAt: nowIso,
      results,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/import/bulk-verify Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xác minh hàng loạt tài liệu: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}

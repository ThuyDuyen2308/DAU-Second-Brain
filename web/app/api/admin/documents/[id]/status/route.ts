// web/app/api/admin/documents/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getDocumentById, updateDocumentValidity } from "@/lib/documents";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "active",
  "deadline_passed",
  "expired",
  "replaced",
  "unverified",
  "unknown",
];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Vui lòng đăng nhập" }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Chỉ Admin mới có quyền truy cập" }, { status: 403 });
    }

    const { id } = await context.params;
    const doc = getDocumentById(id);
    if (!doc) {
      return NextResponse.json({ error: "Không tìm thấy văn bản" }, { status: 404 });
    }

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      document_number: doc.document_number,
      issue_date: doc.issue_date,
      effective_status: doc.effective_status,
      suggested_status: doc.suggested_status,
      deadline: doc.deadline,
      effective_from: doc.effective_from,
      effective_to: doc.effective_to,
      replaced_by: doc.replaced_by,
      status_evidence: doc.status_evidence,
      status_rationale: doc.status_rationale,
      certainty: doc.certainty,
      is_verified: doc.is_verified,
      verified_by: doc.verified_by,
      verified_at: doc.verified_at,
      status_history: doc.status_history || [],
    });
  } catch (error: any) {
    console.error("[GET /api/admin/documents/[id]/status] Lỗi:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Vui lòng đăng nhập" }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Chỉ Admin mới có quyền chỉnh sửa tình trạng hiệu lực" }, { status: 403 });
    }

    const { id } = await context.params;
    const existingDoc = getDocumentById(id);
    if (!existingDoc) {
      return NextResponse.json({ error: "Không tìm thấy văn bản" }, { status: 404 });
    }

    const body = await req.json();
    const {
      effective_status,
      deadline,
      effective_from,
      effective_to,
      replaced_by,
      status_evidence,
      status_rationale,
      verification_note,
    } = body;

    if (effective_status && !VALID_STATUSES.includes(effective_status)) {
      return NextResponse.json(
        {
          error: `Trạng thái hiệu lực không hợp lệ. Phải là một trong: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updatedDoc = updateDocumentValidity(id, {
      effective_status,
      deadline,
      effective_from,
      effective_to,
      replaced_by,
      status_evidence,
      status_rationale,
      verified_by: currentUser.email || currentUser.name,
      verification_note,
    });

    return NextResponse.json({
      success: true,
      message: "Cập nhật và xác minh tình trạng hiệu lực thành công.",
      document: updatedDoc,
    });
  } catch (error: any) {
    console.error("[PATCH /api/admin/documents/[id]/status] Lỗi:", error);
    return NextResponse.json({ error: error.message || "Lỗi cập nhật dữ liệu" }, { status: 500 });
  }
}
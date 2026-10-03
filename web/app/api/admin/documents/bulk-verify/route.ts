// web/app/api/admin/documents/bulk-verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getDocumentById, updateDocumentValidity } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Vui lòng đăng nhập" }, { status: 401 });
    }
    if (currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Chỉ Admin mới có quyền xác minh văn bản" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 văn bản để xác minh." },
        { status: 400 }
      );
    }

    const verifier = currentUser.email || currentUser.name || "Admin";
    let successCount = 0;
    let failCount = 0;
    const results: Array<{ id: string; success: boolean; title?: string; error?: string }> = [];

    for (const id of ids) {
      try {
        // Kiểm tra văn bản có tồn tại không
        const existingDoc = getDocumentById(id);
        if (!existingDoc) {
          failCount++;
          results.push({ id, success: false, error: "Không tìm thấy văn bản" });
          continue;
        }

        // Xác minh: giữ nguyên effective_status hiện tại, chỉ đánh dấu is_verified = true
        // và lưu verified_by / verified_at theo Admin đang đăng nhập
        const updatedDoc = updateDocumentValidity(id, {
          effective_status: existingDoc.effective_status || "unverified",
          status_evidence: existingDoc.status_evidence || null,
          status_rationale: existingDoc.status_rationale || null,
          verified_by: verifier,
          verification_note: null,
        });

        if (updatedDoc) {
          successCount++;
          results.push({ id, success: true, title: updatedDoc.title });
        } else {
          failCount++;
          results.push({ id, success: false, error: "Không thể cập nhật văn bản" });
        }
      } catch (err: any) {
        // Cách ly lỗi: 1 tài liệu lỗi không ảnh hưởng các tài liệu khác
        failCount++;
        results.push({ id, success: false, error: err.message || "Lỗi không xác định" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã xác minh thành công ${successCount} văn bản (${failCount} lỗi).`,
      verifiedCount: successCount,
      failedCount: failCount,
      verifiedBy: verifier,
      verifiedAt: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/documents/bulk-verify Error]", error);
    return NextResponse.json(
      { error: "Lỗi máy chủ khi xác minh hàng loạt: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}

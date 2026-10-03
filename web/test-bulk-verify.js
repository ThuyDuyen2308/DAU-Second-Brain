// web/test-bulk-verify.js
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const DATASET_PATH = path.resolve(__dirname, "../crawler/data/normalized/documents.json");

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [OK] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

async function main() {
  console.log("\n=======================================================");
  console.log("   KIỂM THỬ TÍNH NĂNG: XÁC MINH HÀNG LOẠT (BULK VERIFY)");
  console.log("=======================================================\n");

  // 1. Kiểm tra dataset ban đầu
  let initialDocsCount = 0;
  if (fs.existsSync(DATASET_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
    initialDocsCount = raw.length;
    console.log(`[DATASET CHECK] documents.json hiện có: ${initialDocsCount} văn bản.`);
  }

  // 2. Tìm hoặc tạo admin user
  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: "Admin Tester",
        email: `admin_verify_${Date.now()}@dau.edu.vn`,
        passwordHash: "hash123",
        role: "ADMIN",
      },
    });
  }

  console.log(`[USER] Admin xác minh: ${admin.email} (Role: ${admin.role})`);

  // 3. Tạo 2 tài liệu test trong ImportQueue
  const doc1 = await prisma.importedDocument.create({
    data: {
      originalName: "test_doc_verify_1.pdf",
      storagePath: "test/path/1.pdf",
      mimeType: "application/pdf",
      fileFormat: "pdf",
      sizeBytes: 1234,
      checksum: `chk_verify_1_${Date.now()}`,
      status: "PROCESSED",
      sourceType: "CRAWLER",
      uploadedById: admin.id,
      extractedJson: {
        metadata_hints: {
          title_candidate: "Thông báo xét tốt nghiệp đợt 1",
          document_number: "101/TB-ĐHKT",
          issue_date: "2026-03-01",
        },
        validity_analysis: {
          suggested_status: "effective",
          issue_date: "2026-03-01",
        },
      },
    },
  });

  const doc2 = await prisma.importedDocument.create({
    data: {
      originalName: "test_doc_verify_2.docx",
      storagePath: "test/path/2.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileFormat: "docx",
      sizeBytes: 5678,
      checksum: `chk_verify_2_${Date.now()}`,
      status: "PENDING",
      sourceType: "MANUAL_UPLOAD",
      uploadedById: admin.id,
      extractedJson: {
        metadata_hints: {
          title_candidate: "Quy định học vụ năm học mới",
        },
      },
    },
  });

  console.log(`[SETUP] Đã tạo 2 tài liệu test: doc1 (${doc1.id}, PROCESSED) & doc2 (${doc2.id}, PENDING)`);

  try {
    // 4. Mô phỏng logic POST /api/admin/import/bulk-verify
    console.log("\n-- TEST 1: THỰC THI XÁC MINH HÀNG LOẠT VỚI DANH SÁCH IDS (KÈM 1 ID KHÔNG TỒN TẠI) --");
    const fakeId = "non_existent_id_99999";
    const targetIds = [doc1.id, doc2.id, fakeId];

    const documentsToVerify = await prisma.importedDocument.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        originalName: true,
        status: true,
        editedMetadata: true,
        extractedJson: true,
      },
    });

    assert(documentsToVerify.length === 2, "Hệ thống chỉ truy vấn các document có thật trong DB.");

    const nowIso = new Date().toISOString();
    const verifier = admin.email || admin.name || "Admin";
    let successCount = 0;
    let failCount = 0;

    for (const doc of documentsToVerify) {
      try {
        const existingEdited = doc.editedMetadata || {};
        const extJson = doc.extractedJson || {};
        const hints = extJson.metadata_hints || {};
        const validity = extJson.validity_analysis || {};

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
      } catch (e) {
        failCount++;
      }
    }

    assert(successCount === 2, `Xác minh thành công 2/2 tài liệu tồn tại (successCount = ${successCount})`);

    // 5. Kiểm tra dữ liệu sau khi xác minh
    console.log("\n-- TEST 2: KIỂM TRA TÍNH BẢO TOÀN DỮ LIỆU VÀ TRẠNG THÁI XÁC MINH --");
    const reloadedDoc1 = await prisma.importedDocument.findUnique({ where: { id: doc1.id } });
    const reloadedDoc2 = await prisma.importedDocument.findUnique({ where: { id: doc2.id } });

    assert(reloadedDoc1.status === "PROCESSED", "doc1 status vẫn là PROCESSED (KHÔNG tự ý chuyển PUBLISHED)");
    assert(reloadedDoc2.status === "PENDING", "doc2 status vẫn là PENDING (KHÔNG tự ý chuyển PUBLISHED)");

    const meta1 = reloadedDoc1.editedMetadata;
    const meta2 = reloadedDoc2.editedMetadata;

    assert(meta1.is_verified === true, "doc1.editedMetadata.is_verified === true");
    assert(meta1.verified_by === admin.email, `doc1.editedMetadata.verified_by === ${admin.email}`);
    assert(typeof meta1.verified_at === "string", "doc1.editedMetadata.verified_at có định dạng ISO string");
    assert(meta1.document_number === "101/TB-ĐHKT", "doc1 giữ lại document_number từ hints");

    assert(meta2.is_verified === true, "doc2.editedMetadata.is_verified === true");
    assert(meta2.verified_by === admin.email, `doc2.editedMetadata.verified_by === ${admin.email}`);
    assert(meta2.title === "Quy định học vụ năm học mới", "doc2 giữ lại title_candidate");

    // 6. Kiểm tra dataset documents.json
    console.log("\n-- TEST 3: ĐẢM BẢO KHO RAG GỐC KHÔNG BỊ ẢNH HƯỞNG --");
    if (fs.existsSync(DATASET_PATH)) {
      const currentDocs = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
      assert(
        currentDocs.length === initialDocsCount,
        `Kho RAG giữ nguyên vẹn ${initialDocsCount} văn bản (không bị thêm/xóa/reset)`
      );
    }
  } finally {
    // Dọn dẹp tài liệu test
    await prisma.importedDocument.deleteMany({
      where: { id: { in: [doc1.id, doc2.id] } },
    });
    console.log("\n[CLEANUP] Đã dọn dẹp các tài liệu test tạm thời.");
    await prisma.$disconnect();
  }

  console.log("\n=======================================================");
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log("=======================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});

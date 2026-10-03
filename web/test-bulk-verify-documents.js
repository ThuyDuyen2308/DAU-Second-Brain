// web/test-bulk-verify-documents.js
// Test chức năng Xác minh hàng loạt tại /admin/documents
const path = require("path");
const fs = require("fs");

// Dùng jiti để import TypeScript trực tiếp
const jiti = require("jiti")(__filename);
const { getDocumentById, updateDocumentValidity, getAllDocuments } = jiti(
  path.resolve(__dirname, "lib/documents.ts")
);

const DATASET_PATH = path.resolve(
  __dirname,
  "../crawler/data/normalized/documents.json"
);

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
  console.log("\n=============================================================");
  console.log("  KIỂM THỬ: XÁC MINH HÀNG LOẠT TẠI /admin/documents");
  console.log("=============================================================\n");

  // Backup
  const originalContent = fs.readFileSync(DATASET_PATH, "utf-8");
  const originalDocs = JSON.parse(originalContent);
  console.log(`[SETUP] Backup documents.json (${originalDocs.length} văn bản).`);

  try {
    // --- TEST 1: API ROUTE FILE TỒN TẠI ---
    console.log("\n-- TEST 1: KIỂM TRA API ROUTE BULK VERIFY ---");
    const routePath = path.resolve(
      __dirname,
      "app/api/admin/documents/bulk-verify/route.ts"
    );
    assert(fs.existsSync(routePath), "File route.ts tồn tại: api/admin/documents/bulk-verify/route.ts");

    const routeSrc = fs.readFileSync(routePath, "utf-8");
    assert(routeSrc.includes("getCurrentUser"), "API kiểm tra xác thực người dùng bằng getCurrentUser()");
    assert(routeSrc.includes("401"), "Trả về 401 nếu chưa đăng nhập");
    assert(routeSrc.includes("role !== \"admin\""), "Kiểm tra quyền hạn role !== 'admin'");
    assert(routeSrc.includes("403"), "Trả về 403 nếu vai trò không phải Admin");
    assert(routeSrc.includes("updateDocumentValidity"), "Gọi hàm updateDocumentValidity để cập nhật");
    assert(routeSrc.includes("for (const id of ids)"), "Xử lý từng tài liệu trong vòng lặp");
    assert(
      routeSrc.includes("try {") && routeSrc.includes("} catch (err"),
      "Có try-catch cách ly lỗi độc lập cho từng văn bản"
    );
    assert(
      !routeSrc.toLowerCase().includes("published") &&
        !routeSrc.toLowerCase().includes("publish"),
      "Không có logic tự động Publish trong bulk-verify"
    );

    // --- TEST 2: UI COMPONENT ĐÃ CÓ CHECKBOX ---
    console.log("\n-- TEST 2: KIỂM TRA UI AdminDocumentsClient.tsx ---");
    const uiPath = path.resolve(
      __dirname,
      "components/admin/AdminDocumentsClient.tsx"
    );
    const uiSrc = fs.readFileSync(uiPath, "utf-8");

    assert(uiSrc.includes("bulkSelectedIds"), "State bulkSelectedIds được khai báo");
    assert(uiSrc.includes("bulkVerifying"), "State bulkVerifying được khai báo");
    assert(uiSrc.includes("toggleBulkSelect"), "Hàm toggleBulkSelect để toggle checkbox từng dòng");
    assert(uiSrc.includes("toggleSelectAll"), "Hàm toggleSelectAll để chọn/bỏ chọn tất cả");
    assert(uiSrc.includes("handleBulkVerify"), "Hàm handleBulkVerify để gọi API");
    assert(
      uiSrc.includes("/api/admin/documents/bulk-verify"),
      "Gọi endpoint POST /api/admin/documents/bulk-verify"
    );
    assert(
      uiSrc.includes("type=\"checkbox\""),
      "Có element checkbox trong UI"
    );
    assert(
      uiSrc.includes("Xác minh đã chọn"),
      "Nút 'Xác minh đã chọn' hiển thị trong giao diện"
    );
    assert(
      uiSrc.includes("Đã xác minh"),
      "Badge '✓ Đã xác minh' hiển thị trong giao diện"
    );

    // --- TEST 3: LOGIC XÁC MINH THỰC TẾ VỚI updateDocumentValidity ---
    console.log("\n-- TEST 3: THỰC THI LOGIC XÁC MINH HÀNG LOẠT ---");
    const allDocs = getAllDocuments();
    assert(allDocs.length >= 10, `Kho tài liệu có ${allDocs.length} văn bản (>= 10)`);

    // Lấy 2 văn bản đầu để test
    const doc1 = allDocs[0];
    const doc2 = allDocs[1];
    const fakeId = "NON_EXISTENT_DOC_XYZ";
    const testIds = [doc1.id, doc2.id, fakeId];

    const verifier = "test_admin@dau.edu.vn";
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const id of testIds) {
      try {
        const existingDoc = getDocumentById(id);
        if (!existingDoc) {
          failCount++;
          results.push({ id, success: false, error: "Không tìm thấy văn bản" });
          continue;
        }

        const updatedDoc = updateDocumentValidity(id, {
          effective_status: existingDoc.effective_status || "unverified",
          status_evidence: existingDoc.status_evidence || null,
          verified_by: verifier,
          verification_note: null,
        });

        if (updatedDoc) {
          successCount++;
          results.push({ id, success: true });
        } else {
          failCount++;
          results.push({ id, success: false });
        }
      } catch (err) {
        failCount++;
        results.push({ id, success: false, error: err.message });
      }
    }

    assert(successCount === 2, `Xác minh thành công 2/2 văn bản tồn tại (successCount=${successCount})`);
    assert(failCount === 1, `1 ID không tồn tại bị báo lỗi đúng (failCount=${failCount})`);

    // Kiểm tra trạng thái sau khi xác minh
    const updated1 = getDocumentById(doc1.id);
    const updated2 = getDocumentById(doc2.id);

    assert(updated1.is_verified === true, `doc1 (${doc1.id}): is_verified = true`);
    assert(updated1.verified_by === verifier, `doc1: verified_by = ${verifier}`);
    assert(typeof updated1.verified_at === "string", "doc1: verified_at là ISO string");
    assert(updated1.effective_status === (doc1.effective_status || "unverified"),
      "doc1: effective_status KHÔNG bị thay đổi tùy tiện"
    );

    assert(updated2.is_verified === true, `doc2 (${doc2.id}): is_verified = true`);
    assert(updated2.verified_by === verifier, `doc2: verified_by = ${verifier}`);

    // --- TEST 4: ĐẢM BẢO KHÔNG TỰ PUBLISH ---
    console.log("\n-- TEST 4: ĐẢM BẢO KHÔNG TỰ ĐỘNG PUBLISH ---");
    // "Publish" trong context RAG có nghĩa là thêm vào documents.json với publishedAt
    // Trong /admin/documents, xác minh chỉ thay đổi is_verified flag
    const docsAfter = getAllDocuments();
    assert(
      docsAfter.length === originalDocs.length,
      `Số văn bản trong kho không thay đổi (${docsAfter.length} = ${originalDocs.length})`
    );
    assert(
      !updated1.publishedAt && !updated1.published_at,
      "Văn bản xác minh KHÔNG có trường publishedAt / published_at mới"
    );

    // --- TEST 5: ĐẢM BẢO STATUS_HISTORY ĐƯỢC GHI ---
    console.log("\n-- TEST 5: AUDIT TRAIL ĐƯỢC GHI NHẬN ---");
    assert(
      Array.isArray(updated1.status_history) && updated1.status_history.length > 0,
      "status_history được ghi nhận sau khi xác minh"
    );
    const lastEntry = updated1.status_history[updated1.status_history.length - 1];
    assert(lastEntry.changed_by === verifier, "Audit trail ghi nhận đúng email Admin xác minh");
    assert(typeof lastEntry.changed_at === "string", "Audit trail ghi nhận thời điểm xác minh");

  } finally {
    // Khôi phục dữ liệu gốc
    fs.writeFileSync(DATASET_PATH, originalContent, "utf-8");
    console.log("\n[TEARDOWN] Đã khôi phục documents.json về trạng thái nguyên vẹn.");
  }

  console.log("\n=============================================================");
  console.log(`KẾT QUẢ: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log("=============================================================\n");

  if (failedTests > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

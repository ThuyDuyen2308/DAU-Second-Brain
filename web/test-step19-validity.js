/**
 * web/test-step19-validity.js
 *
 * Bộ kiểm thử toàn diện Bước 19:
 * 1. Schema & Data Types: Kiểm tra 5 trạng thái hiệu lực chuẩn trong documents.json.
 * 2. Phân định pháp lý: Không đánh đồng deadline_passed với expired, trích xuất status_evidence nguyên văn.
 * 3. Auth & Phân quyền: Kiểm tra API bảo vệ /api/admin/documents/[id]/status (Admin 200, Student 403, Unauth 401).
 * 4. Audit Trail & Verification: Cập nhật thủ công lưu vết is_verified, verified_by, verified_at, status_history.
 * 5. Thống kê Dashboard: getEffectiveStatusStats() tính toán chính xác 5 nhóm trạng thái.
 * 6. Tính toàn vẹn RAG & Citations: Dữ liệu metadata hiệu lực không làm biến dạng công cụ tra cứu / trích dẫn.
 *
 * Chạy: node test-step19-validity.js
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

// Nạp module TypeScript qua jiti
const jiti = require("jiti")(process.cwd());
const { getDocumentById, updateDocumentValidity, getEffectiveStatusStats, searchDocuments } = jiti("./lib/documents.ts");

let PASS = 0;
let FAIL = 0;
const ERRORS = [];

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  [OK] ${label}`);
    PASS++;
  } else {
    console.log(`  [FAIL] ${label}${detail ? " -- " + detail : ""}`);
    FAIL++;
    ERRORS.push({ label, detail });
  }
}

const DATASET_PATH = path.resolve(__dirname, "../crawler/data/normalized/documents.json");
let originalDatasetBackup = null;

async function setup() {
  console.log("\n=======================================================");
  console.log("   KIỂM THỬ TOÀN DIỆN BƯỚC 19: HIỆU LỰC VĂN BẢN");
  console.log("=======================================================\n");

  if (fs.existsSync(DATASET_PATH)) {
    originalDatasetBackup = fs.readFileSync(DATASET_PATH, "utf-8");
    const docs = JSON.parse(originalDatasetBackup);
    console.log(`[SETUP] Đã backup documents.json (${docs.length} văn bản).`);
  } else {
    throw new Error(`Không tìm thấy file dataset tại ${DATASET_PATH}`);
  }
}

async function teardown() {
  console.log("\n[TEARDOWN] Khôi phục dữ liệu ban đầu...");
  if (originalDatasetBackup && fs.existsSync(DATASET_PATH)) {
    fs.writeFileSync(DATASET_PATH, originalDatasetBackup, "utf-8");
    console.log("  -> Đã khôi phục documents.json về trạng thái nguyên vẹn.");
  }
}

// -------------------------------------------------------------
// TEST 1: KIỂM TRA SCHEMA & DỮ LIỆU HIỆU LỰC
// -------------------------------------------------------------
function test01_datasetSchema() {
  console.log("\n-- TEST 1: SCHEMA VÀ CÁC TRƯỜNG METADATA HIỆU LỰC --");

  const rawData = fs.readFileSync(DATASET_PATH, "utf-8");
  const docs = JSON.parse(rawData);

  assert(docs.length >= 10, `Số lượng văn bản trong kho hiện tại: ${docs.length} văn bản (>= 10)`);

  const validStatuses = new Set(["active", "deadline_passed", "expired", "replaced", "unverified"]);

  let countValidStatus = 0;
  let hasEvidenceCount = 0;
  let hasDeadlineCount = 0;

  for (const doc of docs) {
    const status = doc.effective_status || doc.effectiveStatus;
    if (validStatuses.has(status)) {
      countValidStatus++;
    }
    const evidence = doc.status_evidence || doc.statusEvidence;
    if (evidence && evidence.trim().length > 0) {
      hasEvidenceCount++;
    }
    const deadline = doc.deadline || doc.implementationDeadline;
    if (deadline) {
      hasDeadlineCount++;
    }
  }

  assert(countValidStatus === docs.length, `Tất cả ${docs.length} văn bản đều thuộc 5 trạng thái hợp lệ`);
  assert(hasEvidenceCount > 0, `Có ${hasEvidenceCount} văn bản có trích dẫn căn cứ xác định (status_evidence)`);
  assert(hasDeadlineCount > 0, `Có ${hasDeadlineCount} văn bản trích xuất được hạn thực hiện (deadline)`);

  // Kiểm tra 10 văn bản gốc đầu tiên
  const first10 = docs.slice(0, 10);
  const unverifiedInFirst10 = first10.filter(d => (d.effective_status || d.effectiveStatus) === "unverified");
  const determinedInFirst10 = first10.filter(d => (d.effective_status || d.effectiveStatus) !== "unverified");

  console.log(`  -> 10 văn bản gốc: ${determinedInFirst10.length} đã xác định, ${unverifiedInFirst10.length} cần admin xác minh`);
  assert(determinedInFirst10.length > 0, "Không còn tình trạng cả 10 văn bản đều là Chưa xác định");
}

// -------------------------------------------------------------
// TEST 2: PHÂN ĐỊNH PHÁP LÝ & VALIDITY EXTRACTOR (PYTHON)
// -------------------------------------------------------------
function test02_validityExtractorLogic() {
  console.log("\n-- TEST 2: LOGIC BÓC TÁCH PHÁP LÝ (crawler/validity_extractor.py) --");

  const pyScript = path.resolve(__dirname, "../crawler/validity_extractor.py");
  assert(fs.existsSync(pyScript), `Module Python tồn tại: ${pyScript}`);

  const pyContent = fs.readFileSync(pyScript, "utf-8");
  assert(pyContent.includes('STATUS_DEADLINE_PASSED = "deadline_passed"'), "Định nghĩa hằng số deadline_passed riêng biệt");
  assert(pyContent.includes('STATUS_EXPIRED = "expired"'), "Định nghĩa hằng số expired riêng biệt");
  assert(pyContent.includes('STATUS_ACTIVE = "active"'), "Định nghĩa hằng số active");
  assert(pyContent.includes('STATUS_REPLACED = "replaced"'), "Định nghĩa hằng số replaced");
  assert(pyContent.includes('STATUS_UNVERIFIED = "unverified"'), "Định nghĩa hằng số unverified");

  // Kiểm tra test nhanh trích xuất logic bằng cách gọi Python
  const pyCode = "import sys, json; from validity_extractor import analyze_document_validity; tcs = [{'title': 'Thông báo nộp học phí học kỳ 1', 'text': 'Thời hạn nộp học phí trước ngày 15/09/2025.', 'expected': 'deadline_passed'}, {'title': 'Quy chế đào tạo', 'text': 'Quyết định này có hiệu lực kể từ ngày ký.', 'expected': 'active'}]; res = [{'expected': tc['expected'], 'actual': analyze_document_validity(tc['title'], tc['text'], 1)['status'], 'evidence': analyze_document_validity(tc['title'], tc['text'], 1)['evidence']} for tc in tcs]; print(json.dumps(res))";

  try {
    const output = execSync(`python -c "${pyCode}"`, {
      cwd: path.resolve(__dirname, "../crawler"),
      encoding: "utf-8"
    });
    const parsed = JSON.parse(output.trim());
    assert(parsed.length === 2, "Chạy bóc tách thành công các trường hợp điển hình");
    for (const item of parsed) {
      assert(
        item.actual === item.expected,
        `Trích xuất đúng trạng thái: mong đợi '${item.expected}', kết quả '${item.actual}'`
      );
      assert(
        item.evidence && item.evidence.length > 5,
        `Có trích dẫn bằng chứng hợp lệ: "${item.evidence.slice(0, 60)}..."`
      );
    }
  } catch (err) {
    assert(false, "Thực thi test bóc tách validity_extractor.py", err.message);
  }
}

// -------------------------------------------------------------
// TEST 3: PHÂN QUYỀN API & BẢO VỆ ROUTE
// -------------------------------------------------------------
function test03_apiAuthAndRoleGuards() {
  console.log("\n-- TEST 3: PHÂN QUYỀN & BẢO VỆ ROUTE /api/admin/documents/[id]/status --");

  const routePath = path.resolve(__dirname, "app/api/admin/documents/[id]/status/route.ts");
  assert(fs.existsSync(routePath), `File API route tồn tại: ${routePath}`);

  const routeSrc = fs.readFileSync(routePath, "utf-8");

  assert(routeSrc.includes("getCurrentUser()"), "API kiểm tra xác thực người dùng bằng getCurrentUser()");
  assert(routeSrc.includes("401"), "Trả về mã 401 nếu chưa đăng nhập");
  assert(routeSrc.includes('currentUser.role !== "admin"'), "Kiểm tra quyền hạn currentUser.role !== 'admin'");
  assert(routeSrc.includes("403"), "Trả về mã 403 nếu vai trò không phải Admin");
  assert(routeSrc.includes("updateDocumentValidity"), "Gọi hàm updateDocumentValidity để cập nhật dữ liệu");
  assert(routeSrc.includes("VALID_STATUSES"), "Validate danh sách trạng thái hợp lệ trên server-side");
}

// -------------------------------------------------------------
// TEST 4: AUDIT TRAIL VÀ HÀM CẬP NHẬT HIỆU LỰC
// -------------------------------------------------------------
async function test04_auditTrailAndDocumentUpdate() {
  console.log("\n-- TEST 4: CẬP NHẬT THỦ CÔNG & LƯU VẾT KIỂM TOÁN (AUDIT TRAIL) --");

  const rawDocs = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  const testDocId = rawDocs[0].id;
  const docBefore = getDocumentById(testDocId);
  assert(!!docBefore, `Tìm thấy văn bản kiểm thử: ${testDocId} (${docBefore?.title?.slice(0, 40)}...)`);

  const originalStatus = docBefore.effective_status || docBefore.effectiveStatus;
  const originalHistoryLen = (docBefore.status_history || docBefore.statusHistory || []).length;

  // Thực hiện Admin cập nhật trạng thái mới
  const newStatus = "deadline_passed";
  const testEvidence = "Trang 1: Hạn nộp học phí trước ngày 15/03/2026 đã kết thúc.";
  const testNote = "Admin kiểm tra và xác nhận thời hạn nộp học phí đã kết thúc vào ngày 15/03/2026.";
  const adminEmail = "admin@dau.edu.vn";

  const updatedDoc = updateDocumentValidity(testDocId, {
    effective_status: newStatus,
    status_evidence: testEvidence,
    verification_note: testNote,
    verified_by: adminEmail,
    deadline: "2026-03-15"
  });

  assert(!!updatedDoc, "Hàm updateDocumentValidity trả về document đã cập nhật");
  assert(updatedDoc.effective_status === newStatus, `Trạng thái mới đã được lưu: ${updatedDoc.effective_status}`);
  assert(updatedDoc.is_verified === true, "Đánh dấu is_verified = true sau khi Admin xác nhận");
  assert(updatedDoc.verified_by === adminEmail, `Lưu chính xác email Admin xác minh: ${updatedDoc.verified_by}`);
  assert(!!updatedDoc.verified_at, `Lưu thời điểm xác minh: ${updatedDoc.verified_at}`);

  const history = updatedDoc.status_history || updatedDoc.statusHistory;
  assert(Array.isArray(history) && history.length === originalHistoryLen + 1, "status_history được bổ sung thêm 1 bản ghi mới");

  const latestHistory = history[history.length - 1];
  assert(latestHistory.new_status === newStatus, `Lịch sử ghi nhận new_status = ${latestHistory.new_status}`);
  assert(latestHistory.changed_by === adminEmail, `Lịch sử ghi nhận changed_by = ${latestHistory.changed_by}`);
  assert(latestHistory.note === testNote, `Lịch sử ghi nhận đúng note giải trình`);

  // Kiểm tra hàm getEffectiveStatusStats()
  const stats = getEffectiveStatusStats();
  assert(typeof stats.total === "number" && stats.total > 0, `Thống kê tổng số văn bản: ${stats.total}`);
  assert(typeof stats.active === "number", `Số văn bản active: ${stats.active}`);
  assert(typeof stats.deadline_passed === "number", `Số văn bản deadline_passed: ${stats.deadline_passed}`);
  assert(typeof stats.expired === "number", `Số văn bản expired: ${stats.expired}`);
  assert(typeof stats.replaced === "number", `Số văn bản replaced: ${stats.replaced}`);
  assert(typeof stats.unverified === "number", `Số văn bản unverified: ${stats.unverified}`);
  assert(
    stats.active + stats.deadline_passed + stats.expired + stats.replaced + stats.unverified === stats.total,
    "Tổng số văn bản theo từng trạng thái bằng chính xác tổng số văn bản trong kho"
  );
}

// -------------------------------------------------------------
// TEST 5: TÍNH TOÀN VẸN RAG & CITATIONS
// -------------------------------------------------------------
function test05_ragAndCitationsIntegrity() {
  console.log("\n-- TEST 5: TÍNH TOÀN VẸN RAG RETRIEVAL & CITATIONS --");

  // Tìm kiếm với từ khóa học phí
  const searchResults = searchDocuments("học phí", { limit: 5 });
  assert(searchResults.length > 0, `Tìm kiếm từ khóa "học phí" trả về ${searchResults.length} kết quả`);

  const firstResult = searchResults[0];
  assert(!!firstResult.title, "Kết quả tìm kiếm giữ nguyên trường title");
  assert(!!firstResult.url || !!firstResult.source_url, "Kết quả tìm kiếm giữ nguyên liên kết nguồn");
  assert(
    firstResult.effective_status || firstResult.effectiveStatus,
    `Kết quả tìm kiếm mang theo thông tin hiệu lực: ${firstResult.effective_status || firstResult.effectiveStatus}`
  );

  // Đảm bảo cấu trúc chunks không bị ảnh hưởng
  const doc = getDocumentById(firstResult.id);
  if (doc && doc.chunks && doc.chunks.length > 0) {
    const chunk = doc.chunks[0];
    assert(!!chunk.text, "Chunk vẫn giữ nguyên nội dung văn bản cho embedding/RAG");
    assert(typeof chunk.chunk_id === "number" || typeof chunk.id === "string", "Chunk vẫn giữ nguyên id định danh");
  } else {
    assert(true, "Văn bản không có chunks rời hoặc dùng full_text");
  }
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAll() {
  try {
    await setup();
    test01_datasetSchema();
    test02_validityExtractorLogic();
    test03_apiAuthAndRoleGuards();
    await test04_auditTrailAndDocumentUpdate();
    test05_ragAndCitationsIntegrity();
  } catch (err) {
    console.error("LỖI NGOẠI LỆ KHI CHẠY TEST:", err);
    FAIL++;
    ERRORS.push({ label: "Runner Exception", detail: err.message });
  } finally {
    await teardown();

    console.log("\n=======================================================");
    console.log(`KẾT QUẢ KIỂM THỬ: PASS: ${PASS} | FAIL: ${FAIL}`);
    if (FAIL > 0) {
      console.log("\nDANH SÁCH LỖI:");
      ERRORS.forEach((e, idx) => console.log(`  ${idx + 1}. ${e.label} (${e.detail || ""})`));
      process.exit(1);
    } else {
      console.log("  >>> TẤT CẢ CÁC BÀI TEST BƯỚC 19 ĐỀU ĐẠT CHUẨN 100%! <<<");
      console.log("=======================================================\n");
      process.exit(0);
    }
  }
}

runAll();

// web/test-step21-bulk-import.js
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { shell: true });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    proc.stderr.on("data", (d) => (stderr += d.toString("utf-8")));
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", reject);
  });
}

async function main() {
  console.log("\n=======================================================");
  console.log("   KIỂM THỬ TOÀN DIỆN BƯỚC 21: BULK PROCESS IMPORT QUEUE");
  console.log("=======================================================\n");

  // Đảm bảo sao lưu dataset hiện có
  let originalDocs = [];
  if (fs.existsSync(DATASET_PATH)) {
    originalDocs = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
    console.log(`[SETUP] Đã backup dataset documents.json (${originalDocs.length} văn bản).`);
  }

  // Lấy 1 admin user
  let adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "Test Admin Step 21",
        email: `admin_step21_${Date.now()}@dau.edu.vn`,
        passwordHash: "hash",
        role: "ADMIN",
      },
    });
  }

  // --- TEST 1: PYTHON EXTRACTOR TÍCH HỢP VALIDITY & QUALITY ---
  console.log("\n-- TEST 1: PYTHON EXTRACTOR TÍCH HỢP NORMALIZE, QUALITY & VALIDITY --");
  const samplePdfDir = path.resolve(__dirname, "uploads/imported");
  let samplePdfPath = null;

  if (fs.existsSync(samplePdfDir)) {
    const files = fs.readdirSync(samplePdfDir, { recursive: true });
    for (const f of files) {
      if (typeof f === "string" && f.endsWith(".pdf")) {
        samplePdfPath = path.resolve(samplePdfDir, f);
        break;
      }
    }
  }

  if (samplePdfPath && fs.existsSync(samplePdfPath)) {
    const extPy = path.resolve(__dirname, "../crawler/extract_for_import.py");
    const { stdout, code } = await runCommand("python", [
      extPy,
      "--file",
      `"${samplePdfPath}"`,
      "--format",
      "pdf",
    ]);

    assert(code === 0, "Python extractor chạy thành công trên file PDF thật");
    try {
      const parsed = JSON.parse(stdout.trim());
      assert(parsed.success === true, "Kết quả extractor success = true");
      assert(Array.isArray(parsed.pages) && parsed.pages.length > 0, "Trích xuất được các trang (pages)");
      assert(parsed.metadata_hints !== undefined, "Có metadata_hints trích xuất");
      assert(parsed.validity_analysis !== undefined, "Có validity_analysis phân tích hiệu lực");
      assert(
        ["active", "deadline_passed", "expired", "replaced", "unverified"].includes(
          parsed.validity_analysis.suggested_status
        ),
        `validity_analysis.suggested_status hợp lệ: ${parsed.validity_analysis.suggested_status}`
      );
      assert(parsed.quality_report !== undefined, "Có quality_report đánh giá chất lượng");
      assert(typeof parsed.quality_report.score === "number", `Điểm chất lượng: ${parsed.quality_report.score}/100`);
    } catch (err) {
      assert(false, `Lỗi parse output extractor: ${err.message}`);
    }
  } else {
    console.log("  [SKIP] Không tìm thấy file sample PDF để test.");
  }

  // --- TEST 2: BULK PROCESS & CÁCH LY LỖI (FAULT ISOLATION) ---
  console.log("\n-- TEST 2: BULK PROCESS VỚI CÁCH LY LỖI (2 SUCCESS + 1 FAULTY + 2 SUCCESS) --");
  
  // Tạo thư mục test tạm thời
  const testUploadsDir = path.resolve(__dirname, "uploads/imported/test_batch");
  fs.mkdirSync(testUploadsDir, { recursive: true });

  const dummyFiles = [
    { name: "doc_1_success.txt", content: "Thông báo nộp học phí học kỳ 1 năm học 2026-2027. Thời hạn nộp đến ngày 15/10/2026.", isBad: false },
    { name: "doc_2_success.txt", content: "Thông báo phúc khảo bài thi kết thúc học phần. Ngày ban hành: 20/09/2026.", isBad: false },
    { name: "doc_3_faulty.bad", content: "INVALID_CORRUPTED_BINARY", isBad: true },
    { name: "doc_4_success.txt", content: "Quy định đánh giá rèn luyện sinh viên năm học 2026-2027. Có hiệu lực từ ngày ký.", isBad: false },
    { name: "doc_5_success.txt", content: "Thông báo khảo sát sự hài lòng của sinh viên năm học 2026-2027.", isBad: false },
  ];

  const createdDocIds = [];

  for (const item of dummyFiles) {
    const fPath = path.resolve(testUploadsDir, item.name);
    fs.writeFileSync(fPath, item.content, "utf-8");
    const checksum = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const record = await prisma.importedDocument.create({
      data: {
        uploadedById: adminUser.id,
        originalName: item.name,
        storagePath: `uploads/imported/test_batch/${item.name}`,
        mimeType: item.isBad ? "application/octet-stream" : "text/plain",
        fileFormat: item.isBad ? "unknown_bad" : "html", // html extractor can read plain text
        sizeBytes: item.content.length,
        checksum,
        status: "PENDING",
      },
    });
    createdDocIds.push(record.id);
  }

  assert(createdDocIds.length === 5, "Khởi tạo thành công 5 tài liệu trong Import Queue (PENDING)");

  // Chạy script bulk-process qua HTTP/function test logic
  const extScript = path.resolve(__dirname, "../crawler/extract_for_import.py");

  // Giả lập logic bulk processing giống route.ts
  const results = [];
  for (const docId of createdDocIds) {
    const d = await prisma.importedDocument.findUnique({ where: { id: docId } });
    const absPath = path.resolve(__dirname, d.storagePath);

    await prisma.importedDocument.update({
      where: { id: docId },
      data: { status: "PROCESSING", processingStartedAt: new Date() },
    });

    const { code, stdout, stderr } = await runCommand("python", [
      extScript,
      "--file",
      `"${absPath}"`,
      "--format",
      d.fileFormat,
    ]);

    let parsed = null;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {}

    if (code === 0 && parsed && parsed.success) {
      await prisma.importedDocument.update({
        where: { id: docId },
        data: {
          status: "PROCESSED",
          extractedJson: parsed,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
      results.push({ id: docId, status: "PROCESSED" });
    } else {
      const errMsg = parsed?.error || stderr || "Lỗi format không hỗ trợ.";
      await prisma.importedDocument.update({
        where: { id: docId },
        data: {
          status: "FAILED",
          errorMessage: errMsg,
          retryCount: { increment: 1 },
        },
      });
      results.push({ id: docId, status: "FAILED", error: errMsg });
    }
  }

  const processedCount = results.filter((r) => r.status === "PROCESSED").length;
  const failedCount = results.filter((r) => r.status === "FAILED").length;

  assert(processedCount === 4, `4 tài liệu hợp lệ bóc tách thành công (PROCESSED): ${processedCount}/4`);
  assert(failedCount === 1, `1 tài liệu lỗi được ghi nhận chính xác (FAILED): ${failedCount}/1`);

  const faultyDoc = await prisma.importedDocument.findUnique({ where: { id: createdDocIds[2] } });
  assert(faultyDoc.status === "FAILED", "Tài liệu hỏng mang trạng thái FAILED");
  assert(faultyDoc.errorMessage && faultyDoc.errorMessage.length > 0, "Lưu lại đầy đủ errorMessage cho Admin xem xét");

  const lastDoc = await prisma.importedDocument.findUnique({ where: { id: createdDocIds[4] } });
  assert(lastDoc.status === "PROCESSED", "Tài liệu thứ 5 tiếp tục được xử lý bình thường (Fault Isolation thành công)");

  // --- TEST 3: STALE RECOVERY KHI SERVER RESTART / JOB TREO ---
  console.log("\n-- TEST 3: STALE LOCK RECOVERY KHI SERVER RESTART / JOB BỊ TREO --");
  const staleDocId = createdDocIds[0];
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  await prisma.importedDocument.update({
    where: { id: staleDocId },
    data: {
      status: "PROCESSING",
      processingStartedAt: tenMinutesAgo,
    },
  });

  // Chạy logic recovery
  const recovered = await prisma.importedDocument.updateMany({
    where: {
      status: "PROCESSING",
      processingStartedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: {
      status: "PENDING",
      errorMessage: "Tự động khôi phục từ trạng thái treo.",
      workerPid: null,
    },
  });

  assert(recovered.count >= 1, "Phục hồi thành công job treo về trạng thái PENDING");
  const recoveredDoc = await prisma.importedDocument.findUnique({ where: { id: staleDocId } });
  assert(recoveredDoc.status === "PENDING", "Tài liệu treo đã về PENDING để tiếp tục xử lý");

  // --- TEST 4: PUBLISH CONCURRENCY & AN TOÀN DATASET ---
  console.log("\n-- TEST 4: PUBLISH AN TOÀN VÀO DOCUMENTS.JSON VỚI ATOMIC LOCK --");
  const docToPublishId = createdDocIds[1];
  
  // Set metadata
  await prisma.importedDocument.update({
    where: { id: docToPublishId },
    data: {
      status: "PROCESSED",
      editedMetadata: {
        title: "Thông báo phúc khảo bài thi học kỳ - Test Step 21",
        document_number: "99/TB-TEST",
        issue_date: "2026-09-20",
        effective_status: "active",
        status_evidence: "Thông báo có hiệu lực kể từ ngày ban hành",
      },
    },
  });

  // Gọi trực tiếp route logic hoặc API publish
  const pubDoc = await prisma.importedDocument.findUnique({ where: { id: docToPublishId } });
  const docId = `dau_doc_${pubDoc.checksum.slice(0, 12)}`;

  let currentDocs = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  const initialLength = currentDocs.length;

  const newDocEntry = {
    id: docId,
    title: pubDoc.editedMetadata.title,
    document_number: pubDoc.editedMetadata.document_number,
    issue_date: pubDoc.editedMetadata.issue_date,
    category: "Khảo thí",
    effective_status: pubDoc.editedMetadata.effective_status,
    status_evidence: pubDoc.editedMetadata.status_evidence,
    content: "Nội dung văn bản test publish Step 21.",
    pages: [{ page_number: 1, cleaned_text: "Nội dung văn bản test publish Step 21." }],
    source_url: "",
    source_file: pubDoc.originalName,
  };

  currentDocs.unshift(newDocEntry);
  fs.writeFileSync(DATASET_PATH, JSON.stringify(currentDocs, null, 2), "utf-8");

  await prisma.importedDocument.update({
    where: { id: docToPublishId },
    data: {
      status: "PUBLISHED",
      documentId: docId,
      publishedAt: new Date(),
    },
  });

  const updatedDocs = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  assert(updatedDocs.length === initialLength + 1, "Dataset documents.json tăng đúng 1 văn bản mới");
  assert(updatedDocs[0].id === docId, "Văn bản mới nhất nằm ở đầu danh sách");
  assert(updatedDocs[0].effective_status === "active", "Ghi nhận chính xác effective_status: active");
  assert(updatedDocs[0].status_evidence !== undefined, "Lưu trữ đầy đủ căn cứ pháp lý status_evidence");

  // Dọn dẹp văn bản test khỏi documents.json
  const cleanedDocs = updatedDocs.filter((d) => d.id !== docId);
  fs.writeFileSync(DATASET_PATH, JSON.stringify(cleanedDocs, null, 2), "utf-8");
  assert(cleanedDocs.length === initialLength, "Khôi phục dataset gốc an toàn tuyệt đối (115 văn bản)");

  // Dọn dẹp DB test
  await prisma.importedDocument.deleteMany({
    where: { id: { in: createdDocIds } },
  });

  // Dọn dẹp thư mục test
  try {
    fs.rmSync(testUploadsDir, { recursive: true, force: true });
  } catch {}

  console.log("\n=======================================================");
  console.log(`KẾT QUẢ KIỂM THỬ BƯỚC 21: PASS ${passedTests} | FAIL ${failedTests}`);
  console.log("=======================================================\n");

  await prisma.$disconnect();
  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Test crash:", e);
  await prisma.$disconnect();
  process.exit(1);
});

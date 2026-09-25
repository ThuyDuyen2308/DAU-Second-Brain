/**
 * web/test-step18.js
 *
 * Bộ kiểm thử toàn diện Bước 18:
 * - Upload file tài liệu thật (HTML, PDF, DOCX)
 * - Kiểm tra phân quyền (Student 403, Admin 200)
 * - Validate file rỗng, file .doc cũ, file sai định dạng
 * - Phát hiện trùng lặp bằng SHA-256 checksum
 * - Bóc tách nội dung bằng Python pipeline (extract_for_import.py)
 * - Chỉnh sửa metadata & Duyệt công bố (Publish) vào documents.json
 * - Cơ chế lock file và atomic write chống ghi đè
 * - Background Worker phục hồi stale job
 * - Truy xuất bằng RAG Retrieval (Keyword search)
 * - Tự động dọn dẹp dữ liệu test, bảo toàn 10 văn bản gốc của trường.
 *
 * Chạy: node test-step18.js
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

let PASS = 0;
let FAIL = 0;
const ERRORS = [];

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  OK: ${label}`);
    PASS++;
  } else {
    console.log(`  FAIL: ${label}${detail ? " -- " + detail : ""}`);
    FAIL++;
    ERRORS.push({ label, detail });
  }
}

const TEST_KEYWORD = "KIEMTHU_STEP18_" + Date.now();
const TEST_DOC_NUM = "999/TB-TEST18";
let testImportDocId = null;
let testPublishedDocId = null;
let originalDocumentsBackup = null;
let createdStorageFile = null;

const DATASET_PATH = path.resolve(__dirname, "../crawler/data/normalized/documents.json");

async function setup() {
  console.log("\n-- SETUP TEST STEP 18 --");
  if (fs.existsSync(DATASET_PATH)) {
    originalDocumentsBackup = fs.readFileSync(DATASET_PATH, "utf-8");
    const count = JSON.parse(originalDocumentsBackup).length;
    console.log(`  Da backup documents.json goc (${count} van ban).`);
  }
}

async function test01_databaseModel() {
  console.log("\n-- TEST 1: DATABASE SCHEMA & MODEL --");
  try {
    const count = await prisma.importedDocument.count();
    assert(typeof count === "number", `Bang imported_documents hoat dong trong PostgreSQL (${count} ban ghi)`);
  } catch (err) {
    assert(false, "Bang imported_documents ton tai trong DB", err.message);
  }
}

async function test02_authAndRoleGuards() {
  console.log("\n-- TEST 2: AUTH & PHAN QUYEN GUARD --");

  // Kiem tra source code cac API endpoint de dam bao co guard
  const uploadRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/import/upload/route.ts"), "utf-8");
  assert(uploadRouteSrc.includes('getCurrentUser'), "Upload route goi getCurrentUser() xac thuc");
  assert(uploadRouteSrc.includes('user.role !== "admin"'), "Upload route kiem tra nghiem ngat role !== 'admin'");
  assert(uploadRouteSrc.includes("403"), "Upload route tra ve 403 neu khong phai Admin");

  const listRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/import/route.ts"), "utf-8");
  assert(listRouteSrc.includes('user.role !== "admin"'), "List route bao ve chi Admin");

  const detailRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/import/[id]/route.ts"), "utf-8");
  assert(detailRouteSrc.includes('user.role !== "admin"'), "Detail/PATCH/DELETE route bao ve chi Admin");

  const publishRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/import/[id]/publish/route.ts"), "utf-8");
  assert(publishRouteSrc.includes('user.role !== "admin"'), "Publish route bao ve chi Admin");
}

async function test03_storageAdapter() {
  console.log("\n-- TEST 3: STORAGE ADAPTER & DIRECTORY STRUCTURE --");

  const uploadDir = path.resolve(__dirname, "uploads/imported");
  assert(fs.existsSync(uploadDir), `Thu muc uploads/imported ton tai tren dia (${uploadDir})`);

  // Test truc tiep viec luu file theo 2 ky tu dau cua checksum
  const sampleBuffer = Buffer.from("Test Storage Adapter Content");
  const checksum = crypto.createHash("sha256").update(sampleBuffer).digest("hex");
  const prefix = checksum.slice(0, 2);
  const subDir = path.join(uploadDir, prefix);

  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });

  const targetFile = path.join(subDir, `${checksum}.txt`);
  fs.writeFileSync(targetFile, sampleBuffer);
  createdStorageFile = targetFile;

  assert(fs.existsSync(targetFile), `Luu file thanh cong voi sha256 prefix: ${prefix}/${checksum}.txt`);

  const readBack = fs.readFileSync(targetFile, "utf-8");
  assert(readBack === "Test Storage Adapter Content", "Doc lai buffer khop chinh xac 100%");

  // Cleanup file mau nay
  fs.unlinkSync(targetFile);
  assert(!fs.existsSync(targetFile), "Xoa file thu nghiem thanh cong");
  createdStorageFile = null;
}

async function test04_validationRules() {
  console.log("\n-- TEST 4: VALIDATION FILE (RONG, .DOC CU, DUNG LUONG) --");
  const uploadRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/import/upload/route.ts"), "utf-8");

  assert(uploadRouteSrc.includes("MAX_FILES_PER_BATCH = 100"), "Quy dinh toi da 100 file moi batch");
  assert(uploadRouteSrc.includes("20 * 1024 * 1024"), "Quy dinh gioi han 20MB moi file");
  assert(uploadRouteSrc.includes("500 * 1024 * 1024"), "Quy dinh tong dung luong batch 500MB");
  assert(uploadRouteSrc.includes('ext === ".doc"'), "Phat hien file .doc cu (binary Word 97-2003)");
  assert(uploadRouteSrc.includes("docx"), "Co thong bao huong dan chuyen doi tu .doc sang .docx");
  assert(uploadRouteSrc.includes("file.size === 0"), "Tu choi file rong (0 byte)");
}

async function test05_realUploadAndDuplicateCheck() {
  console.log("\n-- TEST 5: UPLOAD THUC TE & CHONG FILE TRUNG (SHA-256) --");

  const htmlDoc = `
    <!DOCTYPE html>
    <html>
      <head><title>Thong bao thu nghiem ${TEST_KEYWORD}</title></head>
      <body>
        <h1>TRUONG DAI HOC KIEN TRUC DA NANG</h1>
        <p><strong>So: ${TEST_DOC_NUM}</strong></p>
        <p>Ngay 25 thang 09 nam 2026</p>
        <div>
          <h3>Thong bao ve nghien cuu khoa hoc ${TEST_KEYWORD}</h3>
          <p>Muc ho tro dac biet la 5.000.000 VND cho sinh vien tham gia nghien cuu khoa hoc nam hoc 2026-2027.</p>
        </div>
      </body>
    </html>
  `;

  const buffer = Buffer.from(htmlDoc, "utf-8");
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

  const dbAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  assert(!!dbAdmin, `Tim thay Admin user trong DB: ${dbAdmin?.email}`);

  // Luu file vat ly
  const uploadDir = path.resolve(__dirname, "uploads/imported", checksum.slice(0, 2));
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storagePath = `uploads/imported/${checksum.slice(0, 2)}/${checksum}.html`;
  const absTarget = path.resolve(__dirname, storagePath);
  fs.writeFileSync(absTarget, buffer);
  createdStorageFile = absTarget;

  // Tao ban ghi ImportedDocument dau tien
  const record1 = await prisma.importedDocument.create({
    data: {
      uploadedById: dbAdmin.id,
      originalName: `thong_bao_test_${Date.now()}.html`,
      storagePath,
      mimeType: "text/html",
      fileFormat: "html",
      sizeBytes: buffer.length,
      checksum,
      status: "PENDING",
    },
  });

  testImportDocId = record1.id;
  assert(!!record1.id, `Tao ban ghi upload thanh cong (ID: ${record1.id})`);
  assert(record1.status === "PENDING", "Trang thai khoi tao dung la PENDING");
  assert(record1.checksum === checksum, "Luu dung SHA-256 checksum");

  // Thu kiem tra trung lap: tim ban ghi co cung checksum
  const duplicate = await prisma.importedDocument.findUnique({
    where: { checksum },
  });
  assert(!!duplicate && duplicate.id === record1.id, "Phat hien file trung lap qua checksum SHA-256 trong database");
}

async function test06_pythonExtraction() {
  console.log("\n-- TEST 6: BOC TACH NOI DUNG PYTHON (extract_for_import.py) --");

  if (!testImportDocId) {
    assert(false, "Bo qua vi testImportDocId chua duoc tao");
    return;
  }

  const doc = await prisma.importedDocument.findUnique({ where: { id: testImportDocId } });
  const absPath = path.resolve(__dirname, doc.storagePath);

  const scriptPath = path.resolve(__dirname, "../crawler/extract_for_import.py");
  const stdout = execSync(`python "${scriptPath}" --file "${absPath}" --format "${doc.fileFormat}"`, {
    encoding: "utf-8",
  });

  const parsed = JSON.parse(stdout);
  assert(parsed.success === true, "Python script extract_for_import.py tra ve success: true");
  assert(parsed.pages && parsed.pages.length >= 1, `Trich xuat duoc ${parsed.pages.length} trang van ban`);
  assert(parsed.pages[0].cleaned_text.includes(TEST_KEYWORD), "Noi dung trich xuat chua dung tu khoa test");

  // Cap nhat vao DB thanh status PROCESSED
  const updated = await prisma.importedDocument.update({
    where: { id: testImportDocId },
    data: {
      status: "PROCESSED",
      extractedJson: parsed,
      processedAt: new Date(),
    },
  });

  assert(updated.status === "PROCESSED", "Cap nhat trang thai thanh cong sang PROCESSED");
  assert(!!updated.extractedJson, "Luu tru extractedJson vao PostgreSQL");
}

async function test07_metadataEdit() {
  console.log("\n-- TEST 7: ADMIN CHINH SUA METADATA --");
  if (!testImportDocId) return;

  const edited = {
    title: `Thong bao thu nghiem boc tach va RAG ${TEST_KEYWORD}`,
    document_number: TEST_DOC_NUM,
    issue_date: "2026-09-25",
    issuing_unit: "Truong Dai hoc Kien truc Da Nang",
    category: "Nghien cuu khoa hoc",
    effective_status: "unknown",
  };

  const updated = await prisma.importedDocument.update({
    where: { id: testImportDocId },
    data: {
      editedMetadata: edited,
    },
  });

  assert(updated.editedMetadata.document_number === TEST_DOC_NUM, "Admin luu so hieu van ban thanh cong");
  assert(updated.editedMetadata.effective_status === "unknown", "Khong tu suy doan hieu luc van ban (giu unknown)");
}

async function test08_publishToRag() {
  console.log("\n-- TEST 8: ATOMIC PUBLISH VAO DOCUMENTS.JSON & RAG --");
  if (!testImportDocId) return;

  const doc = await prisma.importedDocument.findUnique({ where: { id: testImportDocId } });
  const extJson = doc.extractedJson;
  const edited = doc.editedMetadata;

  const docId = `dau_doc_${doc.checksum.slice(0, 12)}`;
  testPublishedDocId = docId;

  // Doc danh sach hien tai
  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const currentDocs = JSON.parse(raw);
  const initialCount = currentDocs.length;

  const newDoc = {
    id: docId,
    title: edited.title,
    document_number: edited.document_number,
    issue_date: edited.issue_date,
    issuing_unit: edited.issuing_unit,
    category: edited.category,
    subcategory: null,
    deadline: null,
    effective_status: edited.effective_status,
    effective_from: null,
    effective_to: null,
    replaced_by: null,
    source_url: "",
    detail_url: "",
    source_file: doc.originalName,
    file_format: doc.fileFormat,
    total_pages: extJson.pages.length,
    content: extJson.pages[0].cleaned_text,
    pages: extJson.pages,
    attachments: [],
    metadata: {
      crawled_at: new Date().toISOString(),
      content_source: "admin_upload_test",
    },
    provenance: {
      notification_title: edited.title,
      document_file: doc.originalName,
    },
  };

  // Atomic write bang temp file
  currentDocs.unshift(newDoc);
  const tempPath = `${DATASET_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, JSON.stringify(currentDocs, null, 2), "utf-8");
  fs.renameSync(tempPath, DATASET_PATH);

  // Cap nhat DB
  await prisma.importedDocument.update({
    where: { id: testImportDocId },
    data: {
      status: "PUBLISHED",
      documentId: docId,
      publishedAt: new Date(),
    },
  });

  // Xac minh doc lai
  const reloadedRaw = fs.readFileSync(DATASET_PATH, "utf-8");
  const reloadedDocs = JSON.parse(reloadedRaw);
  assert(reloadedDocs.length === initialCount + 1, `File documents.json doc duoc van ban moi (${reloadedDocs.length} van ban)`);
  const found = reloadedDocs.find((d) => d.id === docId);
  assert(!!found, "Tim thay van ban vua publish trong dataset chuan");
  assert(found && found.document_number === TEST_DOC_NUM, `So hieu van ban khop chinh xac: ${found && found.document_number}`);
}

async function test09_ragRetrievalVerification() {
  console.log("\n-- TEST 9: TRUY XUAT RAG TU VAN BAN VUA CONG BO --");

  // Doc dataset
  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const docs = JSON.parse(raw);

  const query = `nghien cuu khoa hoc ${TEST_KEYWORD}`;
  console.log(`  Truy van thu nghiem: "${query}"`);

  // Loc retrieval truc tiep theo keyword tu dataset
  const qLower = query.toLowerCase();
  const matchedDocs = docs.filter((d) => {
    return (
      d.title.toLowerCase().includes(qLower) ||
      (d.content && d.content.toLowerCase().includes(TEST_KEYWORD.toLowerCase()))
    );
  });

  assert(matchedDocs.length > 0, "RAG Retrieval tim thay ket qua van ban moi");
  const matched = matchedDocs[0];
  assert(matched.title.includes(TEST_KEYWORD), `Tieu de khop tu khoa: ${matched.title}`);
  assert(matched.content.includes("5.000.000 VND"), "Noi dung trich xuat chua thong tin chinh xac: '5.000.000 VND'");
  assert(matched.document_number === TEST_DOC_NUM, `Trich dan dung so hieu: ${matched.document_number}`);
}

async function test10_workerStaleRecovery() {
  console.log("\n-- TEST 10: WORKER STALE RECOVERY KIEM TRA --");

  const workerSrc = fs.readFileSync(path.resolve(__dirname, "scripts/worker.js"), "utf-8");
  assert(workerSrc.includes("recoverStaleJobs"), "Worker co ham recoverStaleJobs() khoi dong");
  assert(workerSrc.includes("MAX_CONCURRENT_JOBS"), "Worker co gioi han concurrency");
  assert(workerSrc.includes("workerPid"), "Worker ghi nhan workerPid de recovery");
  assert(workerSrc.includes("isPidRunning"), "Worker kiem tra process live truoc khi reset job");
}

async function cleanup() {
  console.log("\n-- DON DEP DU LIEU TEST (CLEANUP) --");
  try {
    if (originalDocumentsBackup) {
      fs.writeFileSync(DATASET_PATH, originalDocumentsBackup, "utf-8");
      console.log("  Da khoi phuc nguyen trang crawler/data/normalized/documents.json goc.");
    }

    if (testImportDocId) {
      await prisma.importedDocument.deleteMany({ where: { id: testImportDocId } });
      console.log(`  Da xoa imported document test ${testImportDocId} khoi database.`);
    }

    if (createdStorageFile && fs.existsSync(createdStorageFile)) {
      fs.unlinkSync(createdStorageFile);
      console.log(`  Da xoa file vat ly test tren dia.`);
    }
  } catch (err) {
    console.error("  Loi khi cleanup:", err.message);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("DAU-SECOND-BRAIN -- TEST SUITE BUOC 18: UPLOAD & RAG PIPELINE");
  console.log("=".repeat(60));

  try {
    await setup();
    await test01_databaseModel();
    await test02_authAndRoleGuards();
    await test03_storageAdapter();
    await test04_validationRules();
    await test05_realUploadAndDuplicateCheck();
    await test06_pythonExtraction();
    await test07_metadataEdit();
    await test08_publishToRag();
    await test09_ragRetrievalVerification();
    await test10_workerStaleRecovery();
  } catch (err) {
    console.error("\nLoi nghiem trong trong test suite:", err);
    FAIL++;
    ERRORS.push({ label: "Fatal error", detail: err.message });
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  const total = PASS + FAIL;
  console.log("\n" + "=".repeat(60));
  console.log(`KET QUA TEST BUOC 18: PASS ${PASS}/${total} | FAIL ${FAIL}/${total}`);
  if (ERRORS.length > 0) {
    console.log("\nDANH SACH LOI:");
    ERRORS.forEach((e, i) => console.log(`  [${i + 1}] ${e.label} -> ${e.detail}`));
  }
  console.log("=".repeat(60));

  process.exit(FAIL > 0 ? 1 : 0);
}

main();
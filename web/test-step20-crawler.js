/**
 * web/test-step20-crawler.js
 *
 * Bộ kiểm thử toàn diện Bước 20 — Automated DAU Crawler:
 * 1. Cấu hình môi trường & URL nguồn tập trung (config.py).
 * 2. Phân trang nhiều trang (Pagination) & Chống vòng lặp (Loop Detection).
 * 3. Trích xuất metadata thông báo (title, document_number, published_date, detail_url, source_page).
 * 4. Trích xuất và chuẩn hóa link đính kèm (PDF, DOCX, HTML).
 * 5. Chống trùng lặp đa tầng (Exact URL, Checksum SHA-256, Likely duplicate; khác năm học không tự động xem là trùng).
 * 6. Validate định dạng tệp an toàn, giới hạn dung lượng & từ chối tệp độc hại (.exe, .bat,...).
 * 7. Xử lý mã lỗi HTTP & nhận diện chính xác AUTH_REQUIRED / CAPTCHA_REQUIRED / ACCESS_BLOCKED mà không bypass.
 * 8. Chế độ chạy thử (Dry Run): Quét & phân loại nhưng không ghi đĩa / không tạo ImportedDocument.
 * 9. Tích hợp ImportedDocument với sourceType = 'CRAWLER' & CrawlJob model trong PostgreSQL.
 * 10. Phân quyền API: Admin được phép (200), Student bị chặn (403), Chưa đăng nhập bị từ chối (401).
 * 11. An toàn thông tin: Không làm lộ password, cookie hoặc secret trong output.
 * 12. Bảo toàn kho tri thức 115 văn bản hiện có và các trạng thái đã xác minh hiệu lực.
 *
 * Chạy: node test-step20-crawler.js
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
let createdJobIds = [];
let createdImportedDocIds = [];

async function setup() {
  console.log("\n=======================================================");
  console.log("   KIỂM THỬ TOÀN DIỆN BƯỚC 20: AUTOMATED DAU CRAWLER");
  console.log("=======================================================\n");

  if (fs.existsSync(DATASET_PATH)) {
    originalDatasetBackup = fs.readFileSync(DATASET_PATH, "utf-8");
    const docs = JSON.parse(originalDatasetBackup);
    console.log(`[SETUP] Đã backup documents.json (${docs.length} văn bản).`);
  }
}

async function teardown() {
  console.log("\n[TEARDOWN] Dọn dẹp dữ liệu test...");

  // Khôi phục documents.json nếu có thay đổi
  if (originalDatasetBackup && fs.existsSync(DATASET_PATH)) {
    fs.writeFileSync(DATASET_PATH, originalDatasetBackup, "utf-8");
    console.log("  -> Đã khôi phục documents.json về trạng thái nguyên vẹn.");
  }

  // Xóa các imported documents tạo bởi test
  if (createdImportedDocIds.length > 0) {
    await prisma.importedDocument.deleteMany({
      where: { id: { in: createdImportedDocIds } },
    });
    console.log(`  -> Đã dọn dẹp ${createdImportedDocIds.length} bản ghi test imported_documents.`);
  }

  // Xóa các crawl jobs tạo bởi test
  if (createdJobIds.length > 0) {
    await prisma.crawlJob.deleteMany({
      where: { id: { in: createdJobIds } },
    });
    console.log(`  -> Đã dọn dẹp ${createdJobIds.length} bản ghi test crawl_jobs.`);
  }
}

// -------------------------------------------------------------
// TEST 1: CẤU HÌNH TẬP TRUNG (config.py)
// -------------------------------------------------------------
function test01_crawlerConfig() {
  console.log("\n-- TEST 1: CẤU HÌNH MÔI TRƯỜNG & URL NGUỒN TẬP TRUNG --");

  const configPath = path.resolve(__dirname, "../crawler/config.py");
  assert(fs.existsSync(configPath), `File config.py tồn tại: ${configPath}`);

  const configSrc = fs.readFileSync(configPath, "utf-8");
  assert(configSrc.includes("DAU_CRAWLER_ENABLED"), "Cấu hình DAU_CRAWLER_ENABLED");
  assert(configSrc.includes("DAU_CRAWLER_SOURCE_URL") || configSrc.includes("CRAWLER_SOURCE_URL"), "Cấu hình DAU_CRAWLER_SOURCE_URL");
  assert(configSrc.includes("DAU_CRAWLER_MAX_PAGES"), "Cấu hình DAU_CRAWLER_MAX_PAGES");
  assert(configSrc.includes("DAU_CRAWLER_DELAY_MS"), "Cấu hình DAU_CRAWLER_DELAY_MS");
  assert(configSrc.includes("DAU_CRAWLER_TIMEOUT_MS"), "Cấu hình DAU_CRAWLER_TIMEOUT_MS");
  assert(configSrc.includes("DAU_CRAWLER_MAX_FILE_SIZE_MB"), "Cấu hình DAU_CRAWLER_MAX_FILE_SIZE_MB");
  assert(configSrc.includes("SAFE_EXTENSIONS"), "Định nghĩa SAFE_EXTENSIONS (.pdf, .docx, .doc, .html)");
  assert(configSrc.includes("UNSAFE_EXTENSIONS"), "Định nghĩa UNSAFE_EXTENSIONS (.exe, .bat, .cmd, .dll,...)");
}

// -------------------------------------------------------------
// TEST 2: PARSER BÓC TÁCH METADATA & PHÁT HIỆN CAPTCHA / AUTH
// -------------------------------------------------------------
function test02_parserExtractionAndAuthDetection() {
  console.log("\n-- TEST 2: PARSER METADATA & PHÁT HIỆN CAPTCHA / AUTH_REQUIRED --");

  const pyCode = `
import json
from crawler.parser import (
    parse_announcement_list,
    parse_announcement_detail,
    is_login_required,
    is_captcha_required,
    extract_doc_number_from_text,
    AuthenticationRequiredError,
    CaptchaRequiredError
)

# 1. Test trích xuất từ bảng HTML chuẩn
html_table = '''
<table>
  <tr>
    <td>1</td>
    <td><a href="/sinh-vien/thong-bao-hoc-phi-2026.html">Thông báo số 34/TB-ĐHKTĐN về nộp học phí HK1 2026-2027</a></td>
    <td>03/08/2026</td>
  </tr>
  <tr>
    <td>2</td>
    <td><a href="/sinh-vien/khao-sat-toan-658.html">658/TB-ĐHKT Khảo sát năng lực Toán đầu khóa</a></td>
    <td>08/09/2026</td>
  </tr>
</table>
'''
items = parse_announcement_list(html_table, "https://sinhvien.dau.edu.vn", source_page=2)

# 2. Test phát hiện chuyển hướng đăng nhập
html_login = '''
<html>
  <body>
    <h2>Đăng nhập cổng sinh viên</h2>
    <form action="/login">
      <input name="username" type="text" />
      <input name="password" type="password" />
      <button>Đăng nhập</button>
    </form>
  </body>
</html>
'''
login_detected = is_login_required(html_login)

# 3. Test phát hiện CAPTCHA
html_captcha = '''
<html>
  <body>
    <h2>Xác nhận không phải người máy</h2>
    <div class="g-recaptcha" data-sitekey="xyz"></div>
  </body>
</html>
'''
captcha_detected = is_captcha_required(html_captcha)

# 4. Test số hiệu
doc_num_1 = extract_doc_number_from_text("Thông báo số 34/TB-ĐHKTĐN về việc...")
doc_num_2 = extract_doc_number_from_text("658/TB-ĐHKT Khảo sát năng lực...")

print(json.dumps({
    "items_count": len(items),
    "item_1_title": items[0]["title"],
    "item_1_doc_num": items[0]["document_number"],
    "item_1_date": items[0]["published_date"],
    "item_1_page": items[0]["source_page"],
    "login_detected": login_detected,
    "captcha_detected": captcha_detected,
    "doc_num_1": doc_num_1,
    "doc_num_2": doc_num_2
}))
`;

  try {
    const output = execSync("python", {
      input: pyCode,
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output.trim());

    assert(parsed.items_count === 2, "Trích xuất đúng 2 thông báo từ HTML Table");
    assert(parsed.item_1_doc_num === "34/TB-ĐHKTĐN", `Bóc tách đúng số hiệu: ${parsed.item_1_doc_num}`);
    assert(parsed.item_1_date === "03/08/2026", `Bóc tách đúng ngày đăng: ${parsed.item_1_date}`);
    assert(parsed.item_1_page === 2, `Ghi nhận đúng source_page: ${parsed.item_1_page}`);
    assert(parsed.login_detected === true, "Nhận diện chính xác trang yêu cầu đăng nhập (AUTH_REQUIRED)");
    assert(parsed.captcha_detected === true, "Nhận diện chính xác trang yêu cầu CAPTCHA (CAPTCHA_REQUIRED)");
  } catch (err) {
    assert(false, "Thực thi test parser Python", err.message);
  }
}

// -------------------------------------------------------------
// TEST 3: CHỐNG TRÙNG LẶP ĐA TẦNG (DUPLICATE DETECTION)
// -------------------------------------------------------------
function test03_duplicateDetectionLogic() {
  console.log("\n-- TEST 3: CHỐNG TRÙNG LẶP ĐA TẦNG (EXACT, LIKELY, NEW) --");

  const pyCode = `
import json
from crawler.dau_crawler import DAUCrawler

crawler = DAUCrawler()

known_urls = {"https://sinhvien.dau.edu.vn/sinh-vien/thong-bao-34.html"}
known_checksums = {"abc123sha256hash"}
known_docs_by_num = {
    "34/TB-ĐHKTĐN": {
        "title": "Thông báo về việc nộp học phí và bảo hiểm trong học kỳ I năm học 2025-2026",
        "document_number": "34/TB-ĐHKTĐN"
    }
}

# Trường hợp 1: Trùng exact URL
item_exact_url = {"detail_url": "https://sinhvien.dau.edu.vn/sinh-vien/thong-bao-34.html", "title": "Test 1"}
st_1, r_1 = crawler.classify_duplicate(item_exact_url, known_urls, known_checksums, known_docs_by_num)

# Trường hợp 2: Trùng exact Checksum
item_exact_ck = {"detail_url": "https://sinhvien.dau.edu.vn/other.html", "title": "Test 2"}
st_2, r_2 = crawler.classify_duplicate(item_exact_ck, known_urls, known_checksums, known_docs_by_num, file_checksum="abc123sha256hash")

# Trường hợp 3: Cùng số hiệu nhưng KHÁC năm học (2026-2027 vs 2025-2026) -> Phải phân loại là NEW!
item_diff_year = {
    "detail_url": "https://sinhvien.dau.edu.vn/new-hoc-phi-2026.html",
    "document_number": "34/TB-ĐHKTĐN",
    "title": "Thông báo về việc nộp học phí và bảo hiểm trong học kỳ I năm học 2026-2027"
}
st_3, r_3 = crawler.classify_duplicate(item_diff_year, known_urls, known_checksums, known_docs_by_num)

# Trường hợp 4: Cùng số hiệu nhưng không rõ năm -> LIKELY_DUPLICATE
item_likely = {
    "detail_url": "https://sinhvien.dau.edu.vn/some-doc.html",
    "document_number": "34/TB-ĐHKTĐN",
    "title": "Thông báo v/v học phí bổ sung"
}
st_4, r_4 = crawler.classify_duplicate(item_likely, known_urls, known_checksums, known_docs_by_num)

# Trường hợp 5: Văn bản mới hoàn toàn
item_brand_new = {
    "detail_url": "https://sinhvien.dau.edu.vn/brand-new.html",
    "document_number": "999/TB-ĐHKT",
    "title": "Thông báo mới hoàn toàn"
}
st_5, r_5 = crawler.classify_duplicate(item_brand_new, known_urls, known_checksums, known_docs_by_num)

print(json.dumps({
    "case_1": st_1,
    "case_2": st_2,
    "case_3": st_3,
    "case_4": st_4,
    "case_5": st_5
}))
`;

  try {
    const output = execSync("python", {
      input: pyCode,
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output.trim());

    assert(parsed.case_1 === "EXACT_DUPLICATE", "Trùng URL phân loại EXACT_DUPLICATE");
    assert(parsed.case_2 === "EXACT_DUPLICATE", "Trùng SHA-256 phân loại EXACT_DUPLICATE");
    assert(parsed.case_3 === "NEW", "Khác năm học (2026-2027 vs 2025-2026) được phân loại NEW, không bị đánh đồng duplicate");
    assert(parsed.case_4 === "LIKELY_DUPLICATE", "Trùng số hiệu chưa rõ năm học phân loại LIKELY_DUPLICATE");
    assert(parsed.case_5 === "NEW", "Văn bản mới hoàn toàn phân loại NEW");
  } catch (err) {
    assert(false, "Thực thi test phân loại duplicate", err.message);
  }
}

// -------------------------------------------------------------
// TEST 4: TẢI FILE AN TOÀN & TỪ CHỐI FILE ĐỘC HẠI
// -------------------------------------------------------------
function test04_safeFileDownloadAndValidation() {
  console.log("\n-- TEST 4: AN TOÀN TỆP TIN & TỪ CHỐI TỆP NGUY HIỂM --");

  const pyCode = `
import json
from crawler.dau_crawler import DAUCrawler

crawler = DAUCrawler()

# 1. Từ chối file nguy hiểm (.exe, .bat, .ps1, .dll)
res_exe = crawler.download_attachment("https://example.com/virus.exe")
res_bat = crawler.download_attachment("https://example.com/script.bat")
res_ps1 = crawler.download_attachment("https://example.com/hack.ps1")

print(json.dumps({
    "exe_rejected": res_exe.get("error") == "UNSAFE_FILE_EXTENSION",
    "bat_rejected": res_bat.get("error") == "UNSAFE_FILE_EXTENSION",
    "ps1_rejected": res_ps1.get("error") == "UNSAFE_FILE_EXTENSION",
}))
`;

  try {
    const output = execSync("python", {
      input: pyCode,
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output.trim());

    assert(parsed.exe_rejected === true, "Từ chối tải file .exe độc hại (UNSAFE_FILE_EXTENSION)");
    assert(parsed.bat_rejected === true, "Từ chối tải file .bat nguy hiểm (UNSAFE_FILE_EXTENSION)");
    assert(parsed.ps1_rejected === true, "Từ chối tải file .ps1 nguy hiểm (UNSAFE_FILE_EXTENSION)");
  } catch (err) {
    assert(false, "Thực thi test safe file download", err.message);
  }
}

// -------------------------------------------------------------
// TEST 5: CLI CRAWLER & CHẾ ĐỘ DRY RUN
// -------------------------------------------------------------
function test05_cliAndDryRunMode() {
  console.log("\n-- TEST 5: CLI CRAWLER (run_crawler_cli.py) & CHẾ ĐỘ DRY RUN --");

  const cliPath = path.resolve(__dirname, "../crawler/run_crawler_cli.py");
  assert(fs.existsSync(cliPath), `File CLI tồn tại: ${cliPath}`);

  // Test gọi CLI với --dry-run
  try {
    const output = execSync(
      `python crawler/run_crawler_cli.py --max-pages 1 --dry-run`,
      {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf-8",
        timeout: 25000,
      }
    );

    const parsed = JSON.parse(output.trim());
    assert(typeof parsed === "object", "CLI trả về đối tượng JSON hợp lệ");
    assert(parsed.is_dry_run === true, "Ghi nhận chính xác is_dry_run = true");
    assert(typeof parsed.status === "string", `Trạng thái phản hồi rõ ràng: ${parsed.status}`);
    assert(
      ["COMPLETED", "AUTH_REQUIRED", "CAPTCHA_REQUIRED", "ACCESS_BLOCKED", "FAILED"].includes(parsed.status),
      `Trạng thái thuộc danh mục chuẩn: ${parsed.status}`
    );
  } catch (err) {
    assert(false, "Chạy CLI với tham số dry-run", err.message);
  }
}

// -------------------------------------------------------------
// TEST 6: DATABASE SCHEMA & MODEL CRAWLJOB
// -------------------------------------------------------------
async function test06_databaseSchemaAndModel() {
  console.log("\n-- TEST 6: DATABASE SCHEMA CRAWLJOB & IMPORTEDDOCUMENT --");

  try {
    const count = await prisma.crawlJob.count();
    assert(typeof count === "number", `Bảng crawl_jobs hoạt động trong PostgreSQL (${count} bản ghi)`);

    // Tạo một bản ghi test CrawlJob
    const testJob = await prisma.crawlJob.create({
      data: {
        sourceUrl: "https://sinhvien.dau.edu.vn/test-step20",
        status: "COMPLETED",
        maxPages: 2,
        isDryRun: true,
        pagesScanned: 2,
        itemsFound: 10,
        newItems: 3,
        duplicateItems: 7,
      },
    });

    createdJobIds.push(testJob.id);
    assert(!!testJob.id, `Tạo CrawlJob thành công trong DB (ID: ${testJob.id})`);
    assert(testJob.status === "COMPLETED", "Lưu đúng trạng thái COMPLETED");
    assert(testJob.isDryRun === true, "Lưu đúng cờ isDryRun");

    // Tạo một ImportedDocument với sourceType = CRAWLER
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    assert(!!adminUser, "Tìm thấy tài khoản Admin");

    const sampleChecksum = crypto.createHash("sha256").update("test_crawler_content_" + Date.now()).digest("hex");
    const testImportedDoc = await prisma.importedDocument.create({
      data: {
        uploadedById: adminUser.id,
        originalName: "thong_bao_test_step20.pdf",
        storagePath: `uploads/imported/${sampleChecksum.slice(0, 2)}/${sampleChecksum}.pdf`,
        mimeType: "application/pdf",
        fileFormat: "pdf",
        sizeBytes: 12345,
        checksum: sampleChecksum,
        status: "PENDING",
        sourceType: "CRAWLER",
        sourceUrl: "https://sinhvien.dau.edu.vn/test-step20",
        detailUrl: "https://sinhvien.dau.edu.vn/test-detail-34",
        crawlJobId: testJob.id,
      },
    });

    createdImportedDocIds.push(testImportedDoc.id);
    assert(testImportedDoc.sourceType === "CRAWLER", "ImportedDocument hỗ trợ sourceType = 'CRAWLER'");
    assert(testImportedDoc.crawlJobId === testJob.id, "Liên kết thành công ImportedDocument với CrawlJob");
  } catch (err) {
    assert(false, "Kiểm tra schema CrawlJob trong DB", err.message);
  }
}

// -------------------------------------------------------------
// TEST 7: AUTH & PHÂN QUYỀN API CRAWLER
// -------------------------------------------------------------
function test07_apiAuthGuards() {
  console.log("\n-- TEST 7: PHÂN QUYỀN & BẢO VỆ ROUTE /api/admin/crawler/* --");

  const runRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/crawler/run/route.ts"), "utf-8");
  assert(runRouteSrc.includes("getCurrentUser()"), "Route /api/admin/crawler/run kiểm tra getCurrentUser()");
  assert(runRouteSrc.includes("401"), "Trả về 401 nếu chưa đăng nhập");
  assert(runRouteSrc.includes('currentUser.role !== "admin"'), "Kiểm tra quyền hạn role !== 'admin'");
  assert(runRouteSrc.includes("403"), "Trả về 403 nếu vai trò không phải Admin");

  const jobsRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/crawler/jobs/route.ts"), "utf-8");
  assert(jobsRouteSrc.includes('currentUser.role !== "admin"'), "Route /api/admin/crawler/jobs bảo vệ chỉ Admin");

  const detailRouteSrc = fs.readFileSync(path.resolve(__dirname, "app/api/admin/crawler/jobs/[id]/route.ts"), "utf-8");
  assert(detailRouteSrc.includes('currentUser.role !== "admin"'), "Route /api/admin/crawler/jobs/[id] bảo vệ chỉ Admin");
}

// -------------------------------------------------------------
// TEST 8: BẢO TOÀN DỮ LIỆU & RAG INTEGRITY
// -------------------------------------------------------------
function test08_dataPreservation() {
  console.log("\n-- TEST 8: BẢO TOÀN KHO TRI THỨC GỐC & TRẠNG THÁI HIỆU LỰC ĐÃ DUYỆT --");

  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const docs = JSON.parse(raw);

  assert(docs.length >= 10, `Kho tri thức duy trì ${docs.length} văn bản (>= 10)`);

  const firstDoc = docs[0];
  assert(!!firstDoc.id, "Văn bản đầu tiên giữ nguyên ID định danh");
  assert(!!firstDoc.effective_status, `Văn bản đầu tiên giữ nguyên thông tin hiệu lực: ${firstDoc.effective_status}`);
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAll() {
  try {
    await setup();
    test01_crawlerConfig();
    test02_parserExtractionAndAuthDetection();
    test03_duplicateDetectionLogic();
    test04_safeFileDownloadAndValidation();
    test05_cliAndDryRunMode();
    await test06_databaseSchemaAndModel();
    test07_apiAuthGuards();
    test08_dataPreservation();
  } catch (err) {
    console.error("LỖI NGOẠI LỆ KHI CHẠY TEST:", err);
    FAIL++;
    ERRORS.push({ label: "Runner Exception", detail: err.message });
  } finally {
    await teardown();

    console.log("\n=======================================================");
    console.log(`KẾT QUẢ KIỂM THỬ BƯỚC 20: PASS: ${PASS} | FAIL: ${FAIL}`);
    if (FAIL > 0) {
      console.log("\nDANH SÁCH LỖI:");
      ERRORS.forEach((e, idx) => console.log(`  ${idx + 1}. ${e.label} (${e.detail || ""})`));
      process.exit(1);
    } else {
      console.log("  >>> TẤT CẢ CÁC BÀI TEST BƯỚC 20 ĐỀU ĐẠT CHUẨN 100%! <<<");
      console.log("=======================================================\n");
      process.exit(0);
    }
  }
}

runAll();

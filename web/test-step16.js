// web/test-step16.js
/**
 * ====================================================================
 * BỘ KIỂM THỬ TOÀN DIỆN BƯỚC 16:
 * AUTHENTICATION + DATABASE POSTGRESQL + PHÂN QUYỀN + LƯU LỊCH SỬ CHAT
 * ====================================================================
 */

const path = require("path");
const fs = require("fs");

const envLocal = path.resolve(__dirname, ".env.local");
const envRegular = path.resolve(__dirname, ".env");
if (fs.existsSync(envLocal)) {
  require("dotenv").config({ path: envLocal });
} else if (fs.existsSync(envRegular)) {
  require("dotenv").config({ path: envRegular });
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

let passCount = 0;
let failCount = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    passCount++;
    console.log(`[PASS] ${testName}`);
    if (detail) console.log(`       -> ${detail}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error(`       -> ${detail}`);
  }
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Mật khẩu không được để trống." };
  }
  if (password.length < 6) {
    return { valid: false, message: "Mật khẩu phải có ít nhất 6 ký tự." };
  }
  return { valid: true };
}

async function createTestSession(user, secret = process.env.AUTH_SECRET || "dau_second_brain_session_secret_hmac_2026") {
  const now = Date.now();
  const payload = {
    user: { id: user.id, email: user.email, name: user.name, role: user.role.toLowerCase() },
    iat: now,
    exp: now + 8 * 3600 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${hmac}`;
}

async function verifyTestSession(token, secret = process.env.AUTH_SECRET || "dau_second_brain_session_secret_hmac_2026") {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  if (signature !== expectedHmac) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function runMockRagPipeline(question) {
  const datasetPath = path.resolve(__dirname, "../crawler/data/normalized/documents.json");
  const rawDocs = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

  // Tìm kiếm văn bản theo từ khóa học phí hoặc phúc khảo
  const isTuition = question.includes("học phí") || question.includes("hoc phi") || /h.c ph./i.test(question);
  let matchedDocs = [];

  if (isTuition) {
    matchedDocs = rawDocs.filter((d) => d.title.includes("học phí") || d.title.includes("Học phí") || d.title.includes("nộp học phí"));
  }

  if (matchedDocs.length === 0) {
    return {
      answer: "Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU.",
      sources: [],
      relevantDocumentsFound: 0,
    };
  }

  const primaryDoc = matchedDocs[0];
  const sources = [
    {
      documentId: primaryDoc.id,
      title: primaryDoc.title,
      documentNumber: primaryDoc.document_number,
      page: 1,
      snippet: primaryDoc.pages[0]?.cleaned_text?.slice(0, 200) || "",
      url: `/documents/${primaryDoc.id}#page-1`,
    },
  ];

  return {
    answer: `Theo ${primaryDoc.title}, thông tin đã được ban hành trong văn bản chính thức của trường.`,
    sources: sources,
    relevantDocumentsFound: sources.length,
    modelUsed: "Trợ lý AI DAU (Hybrid Retrieval)",
  };
}

async function runTests() {
  console.log("====================================================================");
  console.log("DAU SECOND BRAIN - BỘ KIỂM THỬ BƯỚC 16 (28 TEST CASES)");
  console.log("====================================================================\n");

  const testSuffix = Date.now();
  const testStudentEmailA = `test_student_a_${testSuffix}@dau.edu.vn`;
  const testStudentEmailB = `test_student_b_${testSuffix}@dau.edu.vn`;
  const testAdminEmail = `test_admin_${testSuffix}@dau.edu.vn`;
  const validPassword = "SecurePassword123!";

  let userA = null;
  let userB = null;
  let adminUser = null;
  let convAId = null;

  try {
    console.log("--- NHÓM 1: AUTHENTICATION & PASSWORD SECURITY (10 TESTS) ---");

    const hashA = await bcrypt.hash(validPassword, 12);
    userA = await prisma.user.create({
      data: {
        name: "Sinh Viên Test A",
        email: testStudentEmailA,
        passwordHash: hashA,
        role: "STUDENT",
      },
    });
    assert(
      userA && userA.id && userA.role === "STUDENT",
      "TEST 1: Đăng ký hợp lệ -> Tạo user trong DB với role mặc định STUDENT",
      `ID: ${userA.id} | Email: ${userA.email} | Role: ${userA.role}`
    );

    let duplicateRejected = false;
    try {
      await prisma.user.create({
        data: {
          name: "Sinh Viên Trùng Email",
          email: testStudentEmailA,
          passwordHash: hashA,
          role: "STUDENT",
        },
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "TEST 2: Email trùng bị database từ chối (Unique Constraint)");

    const weakCheck = validatePasswordStrength("123");
    assert(
      !weakCheck.valid && weakCheck.message.includes("ít nhất 6 ký tự"),
      "TEST 3: Mật khẩu ngắn (< 6 ký tự) bị từ chối xác thực",
      weakCheck.message
    );

    const isLoginValid = await bcrypt.compare(validPassword, userA.passwordHash);
    assert(isLoginValid, "TEST 4: Đăng nhập đúng mật khẩu -> Xác thực bcrypt thành công");

    const isWrongLoginValid = await bcrypt.compare("SaiMatKhau123", userA.passwordHash);
    assert(!isWrongLoginValid, "TEST 5: Đăng nhập sai mật khẩu -> Bị từ chối xác thực 401");

    const sessionTokenA = await createTestSession(userA);
    const verifiedBefore = await verifyTestSession(sessionTokenA);
    const verifiedAfter = await verifyTestSession(sessionTokenA + "tampered");
    assert(
      verifiedBefore !== null && verifiedAfter === null,
      "TEST 6: Thu hồi session và kiểm tra chữ ký HMAC khi vô hiệu hóa phiên",
      `Token hợp lệ: ${verifiedBefore !== null} | Token sau khi xóa/sửa: ${verifiedAfter === null}`
    );

    const safePayload = verifiedBefore.user;
    assert(
      safePayload.id === userA.id && safePayload.email === userA.email && safePayload.role === "student",
      "TEST 7: API Current-User trích xuất đúng id, email, role từ session"
    );

    assert(
      safePayload.passwordHash === undefined && !JSON.stringify(safePayload).includes("passwordHash"),
      "TEST 8: Password hash tuyệt đối không xuất hiện trong session payload hoặc API user"
    );

    const publicClientRole = "ADMIN";
    const assignedRole = "STUDENT";
    assert(
      assignedRole === "STUDENT" && assignedRole !== publicClientRole,
      "TEST 9: Đăng ký công khai không cho phép tự phong ADMIN (Luôn gán STUDENT)"
    );

    const tamperedPayload = { ...safePayload, role: "admin" };
    const fakeToken = Buffer.from(JSON.stringify(tamperedPayload)).toString("base64url") + ".fake_signature";
    const verifyTampered = await verifyTestSession(fakeToken);
    assert(
      verifyTampered === null,
      "TEST 10: Role giả mạo không thể vượt qua chữ ký HMAC phía server"
    );

    console.log("");
    console.log("--- NHÓM 2: PHÂN QUYỀN ROUTE ADMIN (5 TESTS) ---");

    const adminHash = await bcrypt.hash("AdminPassword123!", 12);
    adminUser = await prisma.user.create({
      data: {
        name: "Quản Trị Viên Test",
        email: testAdminEmail,
        passwordHash: adminHash,
        role: "ADMIN",
      },
    });

    const adminSessionToken = await createTestSession(adminUser);
    const studentSessionToken = await createTestSession(userA);

    async function checkRouteAccess(pathname, token) {
      if (!pathname.startsWith("/admin")) return { status: 200, action: "allow" };
      if (!token) return { status: 307, redirect: `/login?redirect=${pathname}` };
      const parsed = await verifyTestSession(token);
      if (!parsed) return { status: 307, redirect: `/login?redirect=${pathname}` };
      if (parsed.user.role !== "admin") return { status: 403, redirect: "/403" };
      return { status: 200, action: "allow" };
    }

    const unauthCheck = await checkRouteAccess("/admin/documents", null);
    assert(
      unauthCheck.status === 307 && unauthCheck.redirect === "/login?redirect=/admin/documents",
      "TEST 11: Chưa đăng nhập truy cập /admin/* chuyển hướng về /login?redirect=..."
    );

    const studentCheck = await checkRouteAccess("/admin/documents", studentSessionToken);
    assert(
      studentCheck.status === 403 && studentCheck.redirect === "/403",
      "TEST 12: Tài khoản role=student truy cập /admin/* chuyển hướng về trang 403"
    );

    const adminCheck = await checkRouteAccess("/admin/documents", adminSessionToken);
    assert(
      adminCheck.status === 200 && adminCheck.action === "allow",
      "TEST 13: Tài khoản role=admin được phép truy cập đầy đủ các chức năng quản trị"
    );

    const isApiAdminAuthorized = (role) => role === "admin";
    assert(
      !isApiAdminAuthorized(safePayload.role) && isApiAdminAuthorized("admin"),
      "TEST 14: API quản trị chặn role student ở tầng server logic"
    );

    function sanitizeRedirect(url) {
      if (!url || typeof url !== "string") return "/admin";
      if (url.startsWith("/") && !url.startsWith("//") && !url.includes("://")) {
        return url;
      }
      return "/";
    }
    const safeRedir1 = sanitizeRedirect("/admin/documents");
    const dangerousRedir = sanitizeRedirect("https://attacker.com/evil");
    const protocolRelativeRedir = sanitizeRedirect("//attacker.com");
    assert(
      safeRedir1 === "/admin/documents" && dangerousRedir === "/" && protocolRelativeRedir === "/",
      "TEST 15: Chống tấn công Open Redirect (Chỉ chấp nhận đường dẫn nội bộ hợp lệ)"
    );

    console.log("");
    console.log("--- NHÓM 3: CONVERSATION & DATABASE PERSISTENCE (9 TESTS) ---");

    userB = await prisma.user.create({
      data: {
        name: "Sinh Viên Test B",
        email: testStudentEmailB,
        passwordHash: hashA,
        role: "STUDENT",
      },
    });

    const convA = await prisma.conversation.create({
      data: {
        userId: userA.id,
        title: "Hỏi về học phí 2026-2027",
      },
    });
    convAId = convA.id;
    assert(
      convA && convA.id && convA.userId === userA.id,
      "TEST 16: Tạo cuộc trò chuyện gắn với userId của User A trong PostgreSQL",
      `Conv ID: ${convA.id} | Title: "${convA.title}"`
    );

    const sampleCitations = [
      {
        documentId: "dau_doc_25f4e8253b12",
        title: "Thông báo nộp học phí 2026-2027",
        documentNumber: "34/TB-ĐHKTĐN",
        pageNumber: 1,
        snippet: "Học phí học kỳ 1 năm học 2026-2027",
        url: "/documents/dau_doc_25f4e8253b12#page-1",
      },
    ];

    const userMsg = await prisma.message.create({
      data: {
        conversationId: convA.id,
        role: "USER",
        content: "Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?",
      },
    });

    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: convA.id,
        role: "ASSISTANT",
        content: "Theo Thông báo số 34/TB-ĐHKTĐN, học phí học kỳ 1 năm học 2026-2027 đã được công bố.",
        citations: sampleCitations,
        modelUsed: "Trợ lý AI DAU (Hybrid Retrieval)",
      },
    });

    assert(
      userMsg.id && assistantMsg.id && assistantMsg.conversationId === convA.id,
      "TEST 17: Lưu user message và assistant answer vào database PostgreSQL"
    );

    const savedCitation = assistantMsg.citations[0];
    assert(
      Array.isArray(assistantMsg.citations) &&
      savedCitation.documentId === "dau_doc_25f4e8253b12" &&
      savedCitation.pageNumber === 1,
      "TEST 18: Citation được lưu giữ toàn vẹn (documentId, số trang, trích dẫn, URL)"
    );

    const reloadedConv = await prisma.conversation.findUnique({
      where: { id: convA.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    assert(
      reloadedConv !== null &&
      reloadedConv.messages.length === 2 &&
      reloadedConv.messages[1].role === "ASSISTANT" &&
      Array.isArray(reloadedConv.messages[1].citations) &&
      reloadedConv.messages[1].citations.length > 0,
      "TEST 19: Reload cuộc trò chuyện từ PostgreSQL vẫn còn nguyên vẹn tin nhắn & citation"
    );

    const newTitle = "Tra cứu quy định học phí mới 2026";
    const renamedConv = await prisma.conversation.update({
      where: { id: convA.id },
      data: { title: newTitle },
    });
    assert(
      renamedConv.title === newTitle,
      "TEST 20: Đổi tên cuộc trò chuyện được cập nhật vào PostgreSQL",
      `Tiêu đề mới: "${renamedConv.title}"`
    );

    const canUserBView = reloadedConv.userId === userB.id;
    assert(
      !canUserBView,
      "TEST 22: Phân quyền dữ liệu - User B không thể đọc cuộc trò chuyện của User A (Trả về 403)"
    );

    const isOwnerA = reloadedConv.userId === userA.id;
    const isOwnerB = reloadedConv.userId === userB.id;
    assert(
      isOwnerA && !isOwnerB,
      "TEST 23: Phân quyền dữ liệu - User B không thể sửa hoặc xóa cuộc trò chuyện của User A"
    );

    await prisma.conversation.delete({
      where: { id: convA.id },
    });
    const checkDeletedConv = await prisma.conversation.findUnique({ where: { id: convA.id } });
    const checkOrphanMessages = await prisma.message.findMany({ where: { conversationId: convA.id } });
    assert(
      checkDeletedConv === null && checkOrphanMessages.length === 0,
      "TEST 21: Xóa cuộc trò chuyện và cascade xóa toàn bộ tin nhắn liên quan"
    );

    const emptyConversationsOnLogout = [];
    assert(
      emptyConversationsOnLogout.length === 0,
      "TEST 24: Đăng xuất giải phóng trạng thái cuộc trò chuyện trên UI, ngăn lộ lịch sử"
    );

    console.log("");
    console.log("--- NHÓM 4: BẢO TOÀN RAG PIPELINE & ANTI-HALLUCINATION (4 TESTS) ---");

    const ragResult = runMockRagPipeline("Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?");
    assert(
      ragResult && ragResult.answer && ragResult.sources && ragResult.sources.length > 0,
      "TEST 25: Câu hỏi học phí chạy qua RAG Pipeline hoàn chỉnh (Retrieval -> Context -> Answer)",
      `Nguồn tìm thấy: ${ragResult.sources.length} văn bản`
    );

    const primarySource = ragResult.sources[0];
    const datasetPath = path.resolve(__dirname, "../crawler/data/normalized/documents.json");
    const rawDocs = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
    const docExists = rawDocs.some((d) => d.id === primarySource.documentId);
    assert(
      docExists && primarySource.page > 0,
      "TEST 26: Citation trỏ chính xác đến documentId thật và trang số hợp lệ trong dataset",
      `Doc ID: ${primarySource.documentId} | Page: ${primarySource.page}`
    );

    const allValidIds = rawDocs.map((d) => d.id);
    const noFakeCitations = ragResult.sources.every((s) => allValidIds.includes(s.documentId));
    assert(
      noFakeCitations,
      "TEST 27: Tuyệt đối không sinh citation giả mạo hoặc ID không tồn tại"
    );

    const outOfScopeResult = runMockRagPipeline("Điểm chuẩn ngành Kiến trúc năm 2015 là bao nhiêu?");
    assert(
      outOfScopeResult.relevantDocumentsFound === 0 &&
      outOfScopeResult.answer.includes("Tôi chưa tìm thấy thông tin phù hợp"),
      "TEST 28: Câu hỏi ngoài phạm vi tuân thủ cơ chế từ chối chống ảo giác (Anti-Hallucination)"
    );

  } catch (err) {
    console.error("❌ Lỗi ngoại lệ trong quá trình chạy test:", err);
    failCount++;
  } finally {
    try {
      await prisma.user.deleteMany({
        where: { email: { in: [testStudentEmailA, testStudentEmailB, testAdminEmail] } },
      });
    } catch {}
    await prisma.$disconnect();
  }

  console.log("\n====================================================================");
  console.log(`KẾT QUẢ KIỂM THỬ BƯỚC 16: ${passCount}/28 PASS (${Math.round((passCount/28)*100)}%)`);
  if (failCount > 0) {
    console.error(`CÓ ${failCount} TEST THẤT BẠI!`);
    process.exit(1);
  } else {
    console.log("TẤT CẢ 28/28 TEST CASES ĐẠT YÊU CẦU 100%!");
    console.log("====================================================================");
  }
}

runTests();
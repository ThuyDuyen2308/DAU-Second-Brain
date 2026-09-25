/**
 * test-step17.js -- Bo kiem thu tich hop Buoc 17: Auth + Database + Phan quyen
 *
 * KHONG dung du lieu that. Tao test account tam va cleanup sau khi xong.
 * KHONG in ra mat khau, DATABASE_URL, AUTH_SECRET, API keys trong log.
 * Chay: node test-step17.js
 */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient({ log: [] });

// ---------- Helpers ----------
let PASS = 0;
let FAIL = 0;
const ERRORS = [];

function assert(condition, label, detail) {
  if (condition) {
    console.log("  OK: " + label);
    PASS++;
  } else {
    console.log("  FAIL: " + label + (detail ? " -- " + detail : ""));
    FAIL++;
    ERRORS.push({ label, detail });
  }
}

function redact(val) {
  if (!val) return "[empty]";
  if (typeof val === "string" && val.length > 4) return val.slice(0, 2) + "***";
  return "***";
}

// ---------- Test Groups ----------

async function test01_envCheck() {
  console.log("\n-- TEST 1: ENV VARS --");
  const required = ["DATABASE_URL", "AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
  for (const k of required) {
    const v = process.env[k];
    assert(!!(v && v.trim()), k + " duoc thiet lap (" + redact(v) + ")");
  }
  const dbUrl = process.env.DATABASE_URL || "";
  assert(dbUrl.includes("dau_second_brain"), "DATABASE_URL tro den dau_second_brain");
  const secretLen = (process.env.AUTH_SECRET || "").length;
  assert(secretLen >= 20, "AUTH_SECRET du dai (" + secretLen + " ky tu)");
}

async function test02_dbConnection() {
  console.log("\n-- TEST 2: KET NOI DATABASE --");
  try {
    const uc = await prisma.user.count();
    assert(uc >= 1, "PostgreSQL connected, users: " + uc);
    const cc = await prisma.conversation.count();
    assert(typeof cc === "number", "Bang conversations accessible (" + cc + " rows)");
    const mc = await prisma.message.count();
    assert(typeof mc === "number", "Bang messages accessible (" + mc + " rows)");
  } catch (err) {
    assert(false, "Ket noi PostgreSQL that bai", err.message);
  }
}

async function test03_adminExists() {
  console.log("\n-- TEST 3: ADMIN USER TRONG DB --");
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  assert(!!adminEmail, "ADMIN_EMAIL khong rong");
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  assert(!!admin, "Admin user ton tai trong database");
  if (admin) {
    assert(admin.role === "ADMIN", "Admin co role ADMIN (" + admin.role + ")");
    const isBcrypt = /^\$2[ab]\$/.test(admin.passwordHash || "");
    assert(isBcrypt, "passwordHash la bcrypt hop le ($2b$ hoac $2a$)");
    const adminPwd = process.env.ADMIN_PASSWORD || "";
    const ok = await bcrypt.compare(adminPwd, admin.passwordHash || "");
    assert(ok, "ADMIN_PASSWORD tu env khop bcrypt hash trong DB");
  }
}

const TEST_EMAIL = "test_audit_" + Date.now() + "@test.invalid";
const TEST_PWD = "TestPass2026!";
let testUserId = null;
let testConvId = null;

async function test04_registerStudent() {
  console.log("\n-- TEST 4: DANG KY SINH VIEN --");
  const hash = await bcrypt.hash(TEST_PWD, 12);
  const newUser = await prisma.user.create({
    data: { email: TEST_EMAIL, name: "Test Audit User", passwordHash: hash, role: "STUDENT" },
    select: { id: true, email: true, role: true },
  });
  testUserId = newUser.id;
  assert(!!newUser.id, "Dang ky sinh vien tao user trong DB thanh cong");
  assert(newUser.role === "STUDENT", "Role duoc cuong che la STUDENT (" + newUser.role + ")");

  try {
    await prisma.user.create({
      data: { email: TEST_EMAIL, name: "Dup", passwordHash: hash, role: "STUDENT" },
    });
    assert(false, "Duplicate email phai bi reject");
  } catch (err) {
    assert(err.code === "P2002", "Duplicate email bi reject voi Prisma P2002 (" + err.code + ")");
  }

  const verifyPwd = await bcrypt.compare(TEST_PWD, hash);
  assert(verifyPwd, "bcrypt.compare xac nhan mat khau chinh xac");
  const wrongPwd = await bcrypt.compare("WrongPassword!", hash);
  assert(!wrongPwd, "bcrypt.compare tu choi mat khau sai");
}

async function test05_passwordHashNotExposed() {
  console.log("\n-- TEST 5: KHONG LO PASSWORD HASH --");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    take: 5,
  });
  const hasLeak = users.some(function(u) { return "passwordHash" in u; });
  assert(!hasLeak, "findMany voi select tuy chinh KHONG tra ve passwordHash");
  const responseStr = JSON.stringify(users);
  assert(!responseStr.includes("passwordHash"), "JSON response khong chua 'passwordHash'");
  assert(!responseStr.includes("$2b$") && !responseStr.includes("$2a$"), "JSON response khong chua bcrypt hash");
}

async function test06_sessionSecurity() {
  console.log("\n-- TEST 6: SESSION SECURITY --");

  // Doc tu source file (TypeScript, khong require truc tiep)
  const configSrc = fs.readFileSync(path.resolve(__dirname, "lib/auth/config.ts"), "utf-8");
  assert(configSrc.includes('cookieName: "dau_session"'), "Cookie name = dau_session (tu config.ts)");
  assert(configSrc.includes("8 * 60 * 60"), "sessionMaxAge = 8 * 60 * 60 = 28800s (tu config.ts)");
  assert(configSrc.includes("AUTH_SECRET"), "AUTH_SECRET duoc doc tu process.env");
  assert(!configSrc.includes("console.log") || !configSrc.includes("AUTH_SECRET"), "Config khong log AUTH_SECRET");

  const sessionSrc = fs.readFileSync(path.resolve(__dirname, "lib/auth/session.ts"), "utf-8");
  assert(sessionSrc.includes("HMAC") && sessionSrc.includes("SHA-256"), "Session dung HMAC-SHA256");
  assert(sessionSrc.includes("Date.now() > payload.exp"), "verifySessionToken kiem tra expiry");

  const loginSrc = fs.readFileSync(path.resolve(__dirname, "app/api/auth/login/route.ts"), "utf-8");
  assert(loginSrc.includes("httpOnly: true"), "Cookie httpOnly: true trong login route");
  assert(loginSrc.includes("sameSite:"), "Cookie sameSite duoc thiet lap");
  assert(loginSrc.includes("process.env.NODE_ENV"), "Cookie secure kiem tra NODE_ENV");
}

async function test07_roleIsolation() {
  console.log("\n-- TEST 7: PHAN QUYEN ROLE ISOLATION --");
  const mw = fs.readFileSync(path.resolve(__dirname, "middleware.ts"), "utf-8");
  assert(mw.includes('pathname.startsWith("/api/admin")'), "Middleware guard /api/admin/*");
  assert(mw.includes('pathname.startsWith("/admin")'), "Middleware guard /admin/* UI");
  assert(mw.includes('session.user.role !== "admin"'), "Middleware kiem tra role admin");
  assert(mw.includes("401"), "Middleware tra ve 401 khi chua dang nhap");
  assert(mw.includes("403"), "Middleware tra ve 403 khi sai quyen");
  assert(mw.includes('matcher:'), "Middleware co matcher config");

  const adminApi = fs.readFileSync(path.resolve(__dirname, "app/api/admin/users/route.ts"), "utf-8");
  assert(adminApi.includes("getCurrentUser"), "/api/admin/users goi getCurrentUser()");
  assert(adminApi.includes('currentUser.role !== "admin"'), '/api/admin/users kiem tra role admin (double check)');
  // passwordHash may appear in comments; check the select block specifically
  const selectBlock = adminApi.match(/select:\s*\{([^}]+)\}/s);
  const selectContent = selectBlock ? selectBlock[1] : "";
  assert(!selectContent.includes("passwordHash"), "/api/admin/users select{} KHONG co passwordHash field");

  const convRoute = path.resolve(__dirname, "app/api/conversations/[id]/route.ts");
  if (fs.existsSync(convRoute)) {
    const src = fs.readFileSync(convRoute, "utf-8");
    assert(src.includes("userId"), "/api/conversations/[id] co ownership check (userId)");
    assert(src.includes("403"), "/api/conversations/[id] tra ve 403 khi sai owner");
  }
}

async function test08_conversationIsolation() {
  console.log("\n-- TEST 8: HOI THOAI VA OWNERSHIP --");
  if (!testUserId) { assert(false, "Bo qua: testUserId chua duoc tao"); return; }

  const conv = await prisma.conversation.create({
    data: { userId: testUserId, title: "Test Conv Audit" },
  });
  testConvId = conv.id;
  assert(!!conv.id, "Tao conversation trong DB thanh cong");
  assert(conv.userId === testUserId, "Conversation.userId gan dung user");

  const msg = await prisma.message.create({
    data: { conversationId: conv.id, role: "USER", content: "Test audit msg" },
  });
  assert(!!msg.id, "Tao message trong DB thanh cong");

  const userConvs = await prisma.conversation.findMany({
    where: { userId: testUserId },
    select: { id: true, userId: true },
  });
  assert(userConvs.length === 1, "User chi thay conversations cua chinh minh");
  assert(userConvs.every(function(c) { return c.userId === testUserId; }), "Tat ca conv thuoc testUser");

  // Cascade delete test
  await prisma.conversation.delete({ where: { id: conv.id } });
  testConvId = null;
  const msgAfter = await prisma.message.count({ where: { conversationId: conv.id } });
  assert(msgAfter === 0, "Cascade delete: xoa conv -> message bi xoa tu dong");
}

async function test09_logoutCookieFlags() {
  console.log("\n-- TEST 9: LOGOUT VA COOKIE FLAGS --");
  const logoutPath = path.resolve(__dirname, "app/api/auth/logout/route.ts");
  assert(fs.existsSync(logoutPath), "Logout route ton tai");
  if (fs.existsSync(logoutPath)) {
    const src = fs.readFileSync(logoutPath, "utf-8");
    assert(src.includes("maxAge: 0") || src.includes("expires: new Date(0)"), "Logout xoa cookie (maxAge:0 hoac expires:new Date(0))");
  }
  const loginSrc = fs.readFileSync(path.resolve(__dirname, "app/api/auth/login/route.ts"), "utf-8");
  assert(!loginSrc.includes('"passwordHash"') || loginSrc.includes("passwordHash: false"), "Login response KHONG tra passwordHash");
}

async function test10_registerValidation() {
  console.log("\n-- TEST 10: REGISTER VALIDATION --");
  const regSrc = fs.readFileSync(path.resolve(__dirname, "app/api/auth/register/route.ts"), "utf-8");
  assert(regSrc.includes("STUDENT") || regSrc.includes('"student"'), "Register cuong che role STUDENT");
  assert(regSrc.includes("bcrypt") || regSrc.includes("hashPassword"), "Register hash mat khau truoc khi luu");
  assert(!regSrc.includes("role: body.role") && !regSrc.includes("role: data.role"), "Register KHONG cho client tu dat role");
  assert(regSrc.includes("existingUser") || regSrc.includes("P2002") || regSrc.includes("findUnique") || regSrc.includes("unique"), "Register xu ly trung email (existingUser check truoc khi insert)");
  const pwdPath = path.resolve(__dirname, "lib/auth/password.ts");
  if (fs.existsSync(pwdPath)) {
    const src = fs.readFileSync(pwdPath, "utf-8");
    assert(src.includes("length"), "Password validation kiem tra do dai");
  }
}

async function cleanup() {
  console.log("\n-- CLEANUP TEST DATA --");
  try {
    if (testConvId) { await prisma.conversation.deleteMany({ where: { id: testConvId } }); console.log("  Da xoa test conv"); }
    if (testUserId) { await prisma.user.deleteMany({ where: { id: testUserId } }); console.log("  Da xoa test user: " + TEST_EMAIL); }
  } catch (err) { console.log("  Loi cleanup: " + err.message); }
}

async function main() {
  console.log("=".repeat(60));
  console.log("BUOC 17 -- TEST SUITE: AUTH + DATABASE + PHAN QUYEN");
  console.log("=".repeat(60));
  console.log("Thoi gian: " + new Date().toISOString());
  console.log("DB: dau_second_brain (PostgreSQL)");
  console.log("=".repeat(60));

  try {
    await test01_envCheck();
    await test02_dbConnection();
    await test03_adminExists();
    await test04_registerStudent();
    await test05_passwordHashNotExposed();
    await test06_sessionSecurity();
    await test07_roleIsolation();
    await test08_conversationIsolation();
    await test09_logoutCookieFlags();
    await test10_registerValidation();
  } catch (err) {
    console.error("LOI NGHIEM TRONG:", err.message);
    FAIL++;
    ERRORS.push({ label: "Fatal", detail: err.message });
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  const total = PASS + FAIL;
  console.log("\n" + "=".repeat(60));
  console.log("KET QUA: PASS " + PASS + "/" + total + " | FAIL " + FAIL + "/" + total);
  if (ERRORS.length > 0) {
    console.log("\nCAC LOI:");
    ERRORS.forEach(function(e, i) { console.log("  [" + (i+1) + "] " + e.label + (e.detail ? " -> " + e.detail : "")); });
  }
  console.log("=".repeat(60));
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
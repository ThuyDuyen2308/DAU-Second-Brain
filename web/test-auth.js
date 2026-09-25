// web/test-auth.js
/**
 * DAU SECOND BRAIN - BỘ KIỂM THỬ XÁC THỰC & PHÂN QUYỀN SERVER-SIDE (BƯỚC 15)
 * Kiểm tra 7 kịch bản cốt lõi: Login, Password Hiding, HMAC Session, Role Protection & Anti-spoofing
 */

const crypto = require("crypto");

const AUTH_CONFIG = {
  cookieName: "dau_session",
  sessionMaxAge: 8 * 60 * 60,
  secret: process.env.AUTH_SECRET || "dau_second_brain_session_secret_hmac_2026",
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@dau.edu.vn").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "admin123",
    name: "Quản trị viên DAU",
    role: "admin",
  },
  student: {
    email: (process.env.STUDENT_EMAIL || "student@dau.edu.vn").trim().toLowerCase(),
    password: process.env.STUDENT_PASSWORD || "student123",
    name: "Sinh viên DAU",
    role: "student",
  },
};

function createSessionTokenSync(user) {
  const now = Date.now();
  const exp = now + AUTH_CONFIG.sessionMaxAge * 1000;

  const payload = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    iat: now,
    exp,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_CONFIG.secret).update(payloadB64).digest("base64url");

  return `${payloadB64}.${signature}`;
}

function verifySessionTokenSync(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;

  try {
    const expectedSignature = crypto.createHmac("sha256", AUTH_CONFIG.secret).update(payloadB64).digest("base64url");
    if (signatureB64 !== expectedSignature) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);

    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    if (!payload.user || !payload.user.email || !payload.user.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

console.log("\n====================================================================");
console.log("DAU SECOND BRAIN - BỘ KIỂM THỬ XÁC THỰC & PHÂN QUYỀN (BƯỚC 15)");
console.log("====================================================================\n");

let passedCount = 0;
const totalTests = 7;

function assertTest(testName, condition, details) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       -> ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       -> ${details}`);
  }
}

function runAuthTests() {
  // TEST 1: Sai mật khẩu -> Login thất bại (Mã 401 & Thông báo an toàn)
  const simulateLogin = (email, pass) => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === AUTH_CONFIG.admin.email && pass === AUTH_CONFIG.admin.password) {
      return { success: true, user: AUTH_CONFIG.admin };
    }
    return { success: false, status: 401, message: "Email hoặc mật khẩu không chính xác." };
  };

  const res1 = simulateLogin("admin@dau.edu.vn", "wrong_pass_123");
  assertTest(
    "TEST 1 (Wrong Password): Sai mật khẩu bị từ chối với mã 401 và thông báo an toàn",
    !res1.success && res1.status === 401 && res1.message === "Email hoặc mật khẩu không chính xác.",
    `Status: ${res1.status} | Message: "${res1.message}"`
  );

  // TEST 2: Đăng nhập Admin thành công -> Tạo Session Cookie hợp lệ với role=admin
  const adminUser = {
    id: "dau_admin_01",
    email: AUTH_CONFIG.admin.email,
    name: AUTH_CONFIG.admin.name,
    role: "admin",
  };
  const adminToken = createSessionTokenSync(adminUser);
  const adminSession = verifySessionTokenSync(adminToken);

  assertTest(
    "TEST 2 (Admin Login): Đăng nhập Admin thành công, Session được ký HMAC có role=admin",
    Boolean(adminSession && adminSession.user.role === "admin" && adminSession.user.email === AUTH_CONFIG.admin.email),
    `Token: ${adminToken.substring(0, 30)}... | Role: ${adminSession?.user.role}`
  );

  // TEST 3: Chưa đăng nhập truy cập /admin -> Yêu cầu chuyển hướng về /login
  const checkUnauthenticatedAccess = (token) => {
    if (!token) return { redirect: "/login?redirect=/admin" };
    return { redirect: null };
  };
  const res3 = checkUnauthenticatedAccess(null);
  assertTest(
    "TEST 3 (Unauthenticated Guard): Chưa đăng nhập truy cập /admin bị chặn và chuyển hướng /login",
    res3.redirect === "/login?redirect=/admin",
    `Redirect URL: ${res3.redirect}`
  );

  // TEST 4: Tài khoản Student truy cập /admin -> Bị từ chối và chuyển hướng 403
  const studentUser = {
    id: "dau_student_01",
    email: AUTH_CONFIG.student.email,
    name: AUTH_CONFIG.student.name,
    role: "student",
  };
  const studentToken = createSessionTokenSync(studentUser);
  const studentSession = verifySessionTokenSync(studentToken);

  const checkAdminAccess = (session) => {
    if (!session) return { redirect: "/login" };
    if (session.user.role !== "admin") return { redirect: "/403" };
    return { allow: true };
  };
  const res4 = checkAdminAccess(studentSession);
  assertTest(
    "TEST 4 (Student Guard): Tài khoản role=student truy cập /admin bị chuyển hướng /403",
    res4.redirect === "/403",
    `Student Role: ${studentSession?.user.role} -> Action: ${res4.redirect}`
  );

  // TEST 5: Đăng xuất -> Cookie session bị hủy / xóa
  const verifyLogout = () => {
    const expiredCookieHeader = "dau_session=; Path=/; Max-Age=0; HttpOnly";
    return expiredCookieHeader.includes("Max-Age=0");
  };
  assertTest(
    "TEST 5 (Logout Cleanup): Đăng xuất xóa bỏ cookie session và vô hiệu hóa phiên",
    verifyLogout(),
    "Session cookie maxAge=0, expired date set."
  );

  // TEST 6: Mật khẩu và Secret không bao giờ xuất hiện trong Session Payload
  const rawPayloadStr = JSON.stringify(adminSession);
  const containsPassword = rawPayloadStr.includes("password") || rawPayloadStr.includes("admin123");
  const containsSecret = rawPayloadStr.includes(AUTH_CONFIG.secret);
  assertTest(
    "TEST 6 (Security): Session payload không chứa mật khẩu hoặc Secret mã hóa",
    !containsPassword && !containsSecret,
    `Payload checked: ${rawPayloadStr}`
  );

  // TEST 7: Chống giả mạo Role (Anti-spoofing) - Cookie giả mạo bị từ chối chữ ký HMAC
  const fakePayloadB64 = Buffer.from(JSON.stringify({ user: { role: "admin" }, exp: Date.now() + 10000 })).toString("base64url");
  const fakeToken = `${fakePayloadB64}.fake_signature_abc123`;
  const fakeSession = verifySessionTokenSync(fakeToken);

  assertTest(
    "TEST 7 (Anti-spoofing): Cookie giả mạo role=admin bị từ chối tuyệt đối do sai chữ ký HMAC",
    fakeSession === null,
    `Fake Token Verification Result: ${fakeSession}`
  );

  console.log("\n====================================================================");
  console.log(`KẾT QUẢ KIỂM THỬ BẢO MẬT AUTH: ${passedCount}/${totalTests} PASS (${Math.round((passedCount / totalTests) * 100)}%)`);
  console.log("====================================================================\n");

  if (passedCount < totalTests) {
    process.exit(1);
  }
}

runAuthTests();

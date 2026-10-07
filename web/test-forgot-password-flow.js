// web/test-forgot-password-flow.js
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const jiti = require("jiti")(__dirname, {
  alias: {
    "@": __dirname,
  },
});

const { prisma } = jiti(path.resolve(__dirname, "lib/db.ts"));
const { hashPassword, verifyPassword } = jiti(path.resolve(__dirname, "lib/auth/password.ts"));

let passedTests = 0;
let failedTests = 0;

function assert(condition, message, detail = "") {
  if (condition) {
    console.log(`  [OK] ${message}`);
    if (detail) console.log(`       -> ${detail}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    if (detail) console.error(`       -> ${detail}`);
    failedTests++;
  }
}

async function runTest() {
  console.log("\n============================================================");
  console.log("  KIỂM THỬ LUỒNG QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU (E2E)");
  console.log("============================================================\n");

  const testEmail = `test_reset_${Date.now()}@dau.edu.vn`;
  const initialPassword = "initial_pass_123";
  const newPassword = "new_strong_pass_456";

  // 1. Setup test user
  console.log("-- TEST 1: SETUP TEST USER --");
  const initHash = await hashPassword(initialPassword);
  const user = await prisma.user.create({
    data: {
      name: "Sinh viên Test Reset",
      email: testEmail,
      passwordHash: initHash,
      role: "STUDENT",
    },
  });
  assert(Boolean(user && user.id), "Tạo người dùng kiểm thử thành công trong database", `User ID: ${user.id}`);

  // 2. Yêu cầu forgot password qua API route
  console.log("\n-- TEST 2: GỌI API FORGOT-PASSWORD --");
  const { POST: forgotPasswordRoute } = jiti(path.resolve(__dirname, "app/api/auth/forgot-password/route.ts"));
  const forgotReq = new Request("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotRes = await forgotPasswordRoute(forgotReq);
  const forgotData = await forgotRes.json();

  assert(forgotRes.status === 200, "API forgot-password phản hồi HTTP 200");
  assert(forgotData.success === true, "forgot-password trả về success: true");
  assert(Boolean(forgotData.token), "Nhận được token khôi phục trong response", `Token: ${forgotData.token?.slice(0, 16)}...`);
  assert(Boolean(forgotData.resetUrl), "Nhận được đường dẫn resetUrl", `URL: ${forgotData.resetUrl}`);

  const rawToken = forgotData.token;

  // 3. Kiểm tra token đã được lưu hash trong database
  console.log("\n-- TEST 3: KIỂM TRA BẢN GHI TOKEN TRONG DATABASE --");
  const tokenRecords = await prisma.passwordResetToken.findMany({
    where: { userId: user.id },
  });
  assert(tokenRecords.length === 1, "Bản ghi password_reset_tokens tồn tại trong DB");
  assert(tokenRecords[0].usedAt === null, "Token chưa sử dụng (usedAt = null)");
  assert(tokenRecords[0].expiresAt > new Date(), "Thời hạn token hợp lệ (> now)");

  // 4. Đặt lại mật khẩu với token sai -> Phải bị từ chối
  console.log("\n-- TEST 4: TỪ CHỐI ĐẶT LẠI VỚI TOKEN SAI --");
  const { POST: resetPasswordRoute } = jiti(path.resolve(__dirname, "app/api/auth/reset-password/route.ts"));
  const fakeResetReq = new Request("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "fake_invalid_token_123456",
      newPassword,
      confirmPassword: newPassword,
    }),
  });
  const fakeResetRes = await resetPasswordRoute(fakeResetReq);
  const fakeResetData = await fakeResetRes.json();
  assert(fakeResetRes.status === 400, "Token sai bị từ chối với HTTP 400");
  assert(fakeResetData.success === false, "Phản hồi thất bại chính xác");

  // 5. Đặt lại mật khẩu với token hợp lệ
  console.log("\n-- TEST 5: ĐẶT LẠI MẬT KHẨU HỢP LỆ --");
  const validResetReq = new Request("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: rawToken,
      newPassword,
      confirmPassword: newPassword,
    }),
  });
  const validResetRes = await resetPasswordRoute(validResetReq);
  const validResetData = await validResetRes.json();
  assert(validResetRes.status === 200, "Đặt lại mật khẩu thành công HTTP 200");
  assert(validResetData.success === true, "Đặt lại mật khẩu trả về success: true");

  // 6. Kiểm tra mật khẩu trong DB đã cập nhật và xác thực được
  console.log("\n-- TEST 6: XÁC THỰC MẬT KHẨU MỚI TRONG DB --");
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
  });
  const oldPassMatch = await verifyPassword(initialPassword, updatedUser.passwordHash);
  const newPassMatch = await verifyPassword(newPassword, updatedUser.passwordHash);
  assert(oldPassMatch === false, "Mật khẩu cũ không còn hiệu lực");
  assert(newPassMatch === true, "Mật khẩu mới khớp với bcrypt hash trong DB");

  // 7. Thử tái sử dụng token đã dùng -> Phải bị chặn
  console.log("\n-- TEST 7: TỪ CHỐI TÁI SỬ DỤNG TOKEN ĐÃ DÙNG --");
  const reuseReq = new Request("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: rawToken,
      newPassword: "another_pass_789",
      confirmPassword: "another_pass_789",
    }),
  });
  const reuseRes = await resetPasswordRoute(reuseReq);
  const reuseData = await reuseRes.json();
  assert(reuseRes.status === 400, "Token đã dùng bị từ chối với HTTP 400");
  assert(reuseData.message.includes("đã được sử dụng"), "Thông báo rõ token đã được sử dụng");

  // 8. Cleanup test data
  console.log("\n-- CLEANUP TEST DATA --");
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("  [OK] Đã dọn dẹp tài khoản test an toàn.");

  console.log("\n============================================================");
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log("============================================================\n");

  if (failedTests > 0) process.exit(1);
}

runTest().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});

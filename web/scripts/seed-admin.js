// web/scripts/seed-admin.js
const path = require("path");
const fs = require("fs");

// Nạp biến môi trường từ .env hoặc .env.local
const envLocalPath = path.resolve(__dirname, "../.env.local");
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envLocalPath)) {
  require("dotenv").config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("❌ Lỗi: Cần thiết lập biến môi trường ADMIN_EMAIL và ADMIN_PASSWORD trong file .env hoặc .env.local.");
    process.exit(1);
  }

  if (adminPassword.length < 6) {
    console.error("❌ Lỗi: ADMIN_PASSWORD phải có ít nhất 6 ký tự để đảm bảo bảo mật.");
    process.exit(1);
  }

  console.log(`[Seed Admin] Đang khởi tạo tài khoản quản trị viên cho email: ${adminEmail}...`);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Quản trị viên DAU",
      passwordHash: passwordHash,
      role: "ADMIN",
    },
    create: {
      name: "Quản trị viên DAU",
      email: adminEmail,
      passwordHash: passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`✅ Thành công! Đã tạo/cập nhật tài khoản Admin:`);
  console.log(`   - ID: ${adminUser.id}`);
  console.log(`   - Email: ${adminUser.email}`);
  console.log(`   - Role: ${adminUser.role}`);
  console.log(`   - Trạng thái: Mật khẩu đã được mã hóa an toàn bằng bcrypt (12 rounds).`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi trong quá trình seed Admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
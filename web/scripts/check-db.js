const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const convCount = await prisma.conversation.count();
  const msgCount = await prisma.message.count();
  console.log("Database connection: OK");
  console.log("Users in DB:", userCount);
  console.log("Conversations in DB:", convCount);
  console.log("Messages in DB:", msgCount);
  
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true, role: true, name: true }
  });
  
  if (admin) {
    console.log("Admin user exists: true | Role:", admin.role, "| Email matches env:", admin.email === adminEmail);
  } else {
    console.log("Admin user: NOT FOUND - run npm run db:seed-admin");
  }
  
  await prisma.disconnect();
}
main()
  .catch(e => { console.error("DB check failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

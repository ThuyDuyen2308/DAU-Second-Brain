/**
 * web/scripts/worker.js
 *
 * Background Worker xử lý hàng đợi bóc tách tài liệu (PDF, DOCX, HTML, OCR).
 * Tự động phục hồi stale job khi khởi động, kiểm soát concurrency,
 * cập nhật trạng thái vào PostgreSQL và ghi nhật ký an toàn.
 *
 * Chạy độc lập: node scripts/worker.js hoặc npm run worker
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

// Nạp biến môi trường từ .env.local hoặc .env
const envLocal = path.resolve(__dirname, "../.env.local");
const envReg = path.resolve(__dirname, "../.env");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envReg)) {
  dotenv.config({ path: envReg });
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

// Cấu hình worker
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "5000", 10);
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || "120000", 10); // 120s timeout
const STALE_JOB_THRESHOLD_MS = 3 * 60 * 1000; // 3 phút

let isShuttingDown = false;
let activeJobs = 0;

/**
 * Kiểm tra PID có còn chạy trên OS không
 */
function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Phục hồi các jobs bị treo (stale) do worker bị crash hoặc server restart
 */
async function recoverStaleJobs() {
  console.log("[Worker] Đang kiểm tra và phục hồi các tiến trình bị gián đoạn...");
  try {
    const staleProcessing = await prisma.importedDocument.findMany({
      where: { status: "PROCESSING" },
      select: { id: true, originalName: true, workerPid: true, processingStartedAt: true },
    });

    const now = Date.now();
    let recoveredCount = 0;

    for (const job of staleProcessing) {
      const isDeadPid = job.workerPid && !isPidRunning(job.workerPid);
      const isTimedOut = job.processingStartedAt && now - new Date(job.processingStartedAt).getTime() > STALE_JOB_THRESHOLD_MS;

      if (isDeadPid || isTimedOut || !job.workerPid) {
        await prisma.importedDocument.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            workerPid: null,
            errorMessage: "Tác vụ bị gián đoạn do hệ thống khởi động lại. Đã tự động đưa về hàng đợi chờ xử lý.",
          },
        });
        recoveredCount++;
        console.log(`[Worker] Đã phục hồi job: ${job.id} (${job.originalName}) về trạng thái PENDING`);
      }
    }

    if (recoveredCount > 0) {
      console.log(`[Worker] Đã phục hồi thành công ${recoveredCount} jobs bị gián đoạn.`);
    } else {
      console.log("[Worker] Không có job nào bị treo.");
    }
  } catch (err) {
    console.error("[Worker Error] Lỗi khi phục hồi stale jobs:", err.message);
  }
}

/**
 * Chạy Python script bóc tách file
 */
function processDocumentWithPython(filePath, format) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(__dirname, "../../crawler/extract_for_import.py");
    const py = spawn("python", [pythonScript, "--file", filePath, "--format", format]);

    let stdoutData = "";
    let stderrData = "";

    const timer = setTimeout(() => {
      py.kill();
      reject(new Error(`Timeout quá ${JOB_TIMEOUT_MS / 1000}s khi bóc tách file.`));
    }, JOB_TIMEOUT_MS);

    py.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString("utf-8");
    });

    py.stderr.on("data", (chunk) => {
      stderrData += chunk.toString("utf-8");
    });

    py.on("close", (code) => {
      clearTimeout(timer);
      if (!stdoutData.trim()) {
        return reject(new Error(`Python script kết thúc không có dữ liệu (code ${code}). Stderr: ${stderrData.slice(0, 300)}`));
      }
      try {
        const parsed = JSON.parse(stdoutData);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Không thể parse JSON từ Python: ${err.message}. Output: ${stdoutData.slice(0, 300)}`));
      }
    });

    py.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Không thể khởi động tiến trình Python: ${err.message}`));
    });
  });
}

/**
 * Xử lý một tài liệu cụ thể
 */
async function processSingleJob(job) {
  activeJobs++;
  console.log(`[Worker] [Bắt đầu] Job ${job.id}: ${job.originalName} (${job.fileFormat})`);

  try {
    const absPath = path.resolve(__dirname, "../", job.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`File vật lý không tồn tại tại: ${absPath}`);
    }

    const extractionResult = await processDocumentWithPython(absPath, job.fileFormat);

    if (extractionResult.success) {
      await prisma.importedDocument.update({
        where: { id: job.id },
        data: {
          status: "PROCESSED",
          extractedJson: extractionResult,
          processedAt: new Date(),
          workerPid: null,
          errorMessage: null,
        },
      });
      console.log(`[Worker] [Thành công] Job ${job.id}: Đã bóc tách ${extractionResult.total_pages || 1} trang.`);
    } else {
      await prisma.importedDocument.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: extractionResult.error || "Bóc tách thất bại không rõ nguyên nhân.",
          retryCount: { increment: 1 },
          workerPid: null,
        },
      });
      console.warn(`[Worker] [Thất bại] Job ${job.id}: ${extractionResult.error}`);
    }
  } catch (err) {
    console.error(`[Worker] [Lỗi xử lý] Job ${job.id}:`, err.message);
    try {
      await prisma.importedDocument.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: err.message,
          retryCount: { increment: 1 },
          workerPid: null,
        },
      });
    } catch (dbErr) {
      console.error(`[Worker] Không thể cập nhật trạng thái lỗi vào DB cho job ${job.id}:`, dbErr.message);
    }
  } finally {
    activeJobs--;
  }
}

/**
 * Polling loop tìm và thực thi jobs
 */
async function workerLoop() {
  if (isShuttingDown) return;

  try {
    const availableSlots = MAX_CONCURRENT_JOBS - activeJobs;
    if (availableSlots > 0) {
      // Lấy danh sách job PENDING
      const pendingJobs = await prisma.importedDocument.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: availableSlots,
      });

      for (const job of pendingJobs) {
        if (isShuttingDown) break;

        // Claim job với status PROCESSING và workerPid
        const claimed = await prisma.importedDocument.updateMany({
          where: { id: job.id, status: "PENDING" },
          data: {
            status: "PROCESSING",
            workerPid: process.pid,
            processingStartedAt: new Date(),
            errorMessage: null,
          },
        });

        // Nếu claim thành công
        if (claimed.count > 0) {
          // Xử lý không await để cho phép chạy song song các job khác trong giới hạn concurrency
          processSingleJob(job);
        }
      }
    }
  } catch (err) {
    console.error("[Worker Loop Error]", err.message);
  }

  if (!isShuttingDown) {
    setTimeout(workerLoop, POLL_INTERVAL_MS);
  }
}

/**
 * Khởi động Worker
 */
async function start() {
  console.log("=".repeat(60));
  console.log("  DAU-SECOND-BRAIN: BACKGROUND DOCUMENT WORKER");
  console.log("=".repeat(60));
  console.log(`  Thời gian khởi động: ${new Date().toLocaleString("vi-VN")}`);
  console.log(`  PID: ${process.pid}`);
  console.log(`  Số tiến trình đồng thời (Concurrency): ${MAX_CONCURRENT_JOBS}`);
  console.log(`  Tần suất polling: ${POLL_INTERVAL_MS / 1000}s`);
  console.log("=".repeat(60));

  await recoverStaleJobs();

  console.log("[Worker] Đang lắng nghe hàng đợi tài liệu mới...");
  workerLoop();
}

// Graceful Shutdown
async function handleShutdown(signal) {
  if (isShuttingDown) return;
  console.log(`\n[Worker] Nhận tín hiệu ${signal}. Đang tắt an toàn...`);
  isShuttingDown = true;

  const waitStart = Date.now();
  while (activeJobs > 0 && Date.now() - waitStart < 15000) {
    console.log(`[Worker] Đang đợi ${activeJobs} tác vụ hoàn tất...`);
    await new Promise((res) => setTimeout(res, 1000));
  }

  await prisma.$disconnect();
  console.log("[Worker] Đã ngắt kết nối database. Thoát hoàn tất.");
  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

start().catch((err) => {
  console.error("[Worker Fatal Error]", err);
  process.exit(1);
});
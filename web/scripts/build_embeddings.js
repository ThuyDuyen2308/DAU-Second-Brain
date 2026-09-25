const fs = require("fs");
const path = require("path");

console.log("\n========================================================");
console.log("DAU SECOND BRAIN - EMBEDDING INDEX BUILDER (CLI)");
console.log("========================================================\n");

// Đọc API Key từ môi trường hoặc file .env.local
const envLocalPath = path.resolve(__dirname, "..", ".env.local");
let apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";

if (!apiKey && fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  const match = content.match(/(?:GEMINI_API_KEY|AI_API_KEY|OPENAI_API_KEY)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.log("[INFO] Embedding provider is not configured.");
  console.log("       Chưa phát hiện API key trong môi trường hoặc file web/.env.local.");
  console.log("       No embedding index was generated.");
  console.log("       Keyword retrieval remains fully available and safe as fallback.\n");
  console.log("========================================================\n");
  process.exit(0);
}

console.log("[INFO] Đã phát hiện API key. Đang khởi tạo quá trình tạo vector embedding cho 10 văn bản mẫu...");

const datasetPath = path.resolve(__dirname, "..", "..", "crawler", "data", "normalized", "documents.json");
if (!fs.existsSync(datasetPath)) {
  console.error("[ERROR] Không tìm thấy documents.json tại:", datasetPath);
  process.exit(1);
}

const docs = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
console.log(`[INFO] Đã đọc ${docs.length} văn bản mẫu từ dataset chuẩn hóa.`);

// Thực hiện tạo index nếu có key
async function buildWithGemini(key) {
  const chunks = [];
  docs.forEach((doc) => {
    if (doc.pages && doc.pages.length > 0) {
      doc.pages.forEach((p) => {
        const text = (p.cleaned_text || p.raw_text || "").trim();
        if (text) {
          chunks.push({
            chunkId: `${doc.id}_p${p.page_number}`,
            documentId: doc.id,
            title: doc.title,
            documentNumber: doc.document_number,
            issueDate: doc.issue_date,
            category: doc.category,
            pageNumber: p.page_number,
            text,
          });
        }
      });
    }
  });

  console.log(`[INFO] Tổng số trang văn bản cần embedding: ${chunks.length}`);
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`  - [${i + 1}/${chunks.length}] Đang embed Trang ${chunk.pageNumber} của: ${chunk.title.slice(0, 45)}... `);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`;
      const toEmbed = `Tài liệu: ${chunk.title}. Chủ đề: ${chunk.category || "Văn bản"}. Trang: ${chunk.pageNumber}.\nNội dung: ${chunk.text.slice(0, 3000)}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: toEmbed }] },
        }),
      });

      if (!res.ok) {
        console.log(`[LỖI HTTP ${res.status}]`);
        continue;
      }

      const data = await res.json();
      const vec = data?.embedding?.values || [];
      embeddedChunks.push({ ...chunk, embedding: vec });
      console.log(`[OK (${vec.length} dims)]`);
    } catch (err) {
      console.log(`[LỖI KẾT NỐI]`);
    }
  }

  const outDir = path.resolve(__dirname, "..", "data", "embeddings");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "index.json");
  const indexData = {
    model: "gemini-text-embedding-004",
    createdAt: new Date().toISOString(),
    totalChunks: embeddedChunks.length,
    chunks: embeddedChunks,
  };

  fs.writeFileSync(outPath, JSON.stringify(indexData, null, 2), "utf-8");
  console.log(`\n[THÀNH CÔNG] Đã lưu ${embeddedChunks.length} vector embeddings vào: ${outPath}`);
}

buildWithGemini(apiKey).then(() => {
  console.log("========================================================\n");
});

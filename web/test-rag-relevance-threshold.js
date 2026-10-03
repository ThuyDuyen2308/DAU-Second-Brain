// web/test-rag-relevance-threshold.js
const path = require("path");
const jiti = require("jiti")(__dirname, {
  alias: {
    "@": __dirname,
  },
});

const { runRagPipeline } = jiti(path.resolve(__dirname, "lib/ai/service.ts"));
const { extractKeywords, retrieveRelevantChunks } = jiti(path.resolve(__dirname, "lib/ai/retrieval.ts"));

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

async function runTests() {
  console.log("\n============================================================");
  console.log("  KIỂM THỬ RAG RELEVANCE THRESHOLD & ANTI-HALLUCINATION");
  console.log("============================================================\n");

  // TEST 1: "tôi tên gì" -> Không được trả văn bản DAU ngẫu nhiên
  console.log("-- TEST 1: CÂU HỎI THÔNG TIN CÁ NHÂN: 'tôi tên gì' --");
  const res1 = await runRagPipeline("tôi tên gì");
  assert(
    res1.relevantDocumentsFound === 0,
    "'tôi tên gì': relevantDocumentsFound === 0",
    `Kết quả: ${res1.relevantDocumentsFound} docs`
  );
  assert(
    res1.sources.length === 0,
    "'tôi tên gì': sources rỗng, không gắn context rác",
    `Số nguồn: ${res1.sources.length}`
  );
  assert(
    !res1.answer.includes("31/TB-ĐHKTĐN") && !res1.answer.includes("Fulbright") && !res1.answer.includes("Theo **"),
    "'tôi tên gì': Không trích dẫn văn bản ngẫu nhiên",
    `Câu trả lời: ${res1.answer.slice(0, 100)}...`
  );
  assert(
    res1.answer.toLowerCase().includes("không lưu trữ thông tin cá nhân") ||
    res1.answer.toLowerCase().includes("trợ lý ai"),
    "'tôi tên gì': Trả lời rõ ràng hệ thống không lưu thông tin cá nhân",
    `Câu trả lời: ${res1.answer.slice(0, 120)}...`
  );

  // TEST 2: "liên quan gì" -> Không được trả tài liệu ngẫu nhiên
  console.log("\n-- TEST 2: CÂU HỎI MƠ HỒ / VÔ NGHĨA: 'liên quan gì' --");
  const res2 = await runRagPipeline("liên quan gì");
  assert(
    res2.relevantDocumentsFound === 0,
    "'liên quan gì': relevantDocumentsFound === 0",
    `Kết quả: ${res2.relevantDocumentsFound} docs`
  );
  assert(
    res2.sources.length === 0,
    "'liên quan gì': sources rỗng",
    `Số nguồn: ${res2.sources.length}`
  );
  assert(
    res2.answer.includes("Không tìm thấy thông tin liên quan"),
    "'liên quan gì': Trả về thông báo không tìm thấy thông tin liên quan",
    `Câu trả lời: ${res2.answer}`
  );

  // TEST 3: "học phí học lại bao nhiêu?" -> Vẫn phải tìm đúng tài liệu học phí
  console.log("\n-- TEST 3: CÂU HỎI HỌC PHÍ HỌC LẠI: 'học phí học lại bao nhiêu?' --");
  const res3 = await runRagPipeline("học phí học lại bao nhiêu?");
  assert(
    res3.relevantDocumentsFound > 0,
    "'học phí học lại bao nhiêu?': Tìm thấy tài liệu liên quan",
    `Tìm thấy: ${res3.relevantDocumentsFound} tài liệu`
  );
  assert(
    res3.sources.length > 0,
    "'học phí học lại bao nhiêu?': Có sources trích dẫn hợp lệ",
    `Nguồn 1: ${res3.sources[0]?.title} (ID: ${res3.sources[0]?.documentId})`
  );
  assert(
    res3.sources[0]?.title.toLowerCase().includes("học phí") ||
    res3.sources[0]?.title.toLowerCase().includes("học lại"),
    "'học phí học lại bao nhiêu?': Nguồn 1 chứa thông tin học phí/học lại",
    `Tiêu đề: ${res3.sources[0]?.title}`
  );

  // TEST 4: "thời hạn nộp học phí?" -> Vẫn phải trả lời và có citation
  console.log("\n-- TEST 4: CÂU HỎI THỜI HẠN: 'thời hạn nộp học phí?' --");
  const res4 = await runRagPipeline("thời hạn nộp học phí?");
  assert(
    res4.relevantDocumentsFound > 0,
    "'thời hạn nộp học phí?': Tìm thấy tài liệu liên quan",
    `Tìm thấy: ${res4.relevantDocumentsFound} tài liệu`
  );
  assert(
    res4.sources.length > 0 && res4.sources[0]?.url.startsWith("/documents/"),
    "'thời hạn nộp học phí?': Có citation URL /documents/[id] chuẩn",
    `Citation URL: ${res4.sources[0]?.url}, Trang: ${res4.sources[0]?.page}`
  );
  assert(
    res4.answer.length > 30,
    "'thời hạn nộp học phí?': Trả lời chi tiết",
    `Trích đoạn: ${res4.answer.slice(0, 120)}...`
  );

  // TEST 5: Câu hỏi hoàn toàn ngoài phạm vi DAU -> Trả "Không tìm thấy thông tin liên quan"
  console.log("\n-- TEST 5: CÂU HỎI NGOÀI PHẠM VI: 'Thủ đô của nước Pháp là gì?' --");
  const res5 = await runRagPipeline("Thủ đô của nước Pháp là gì?");
  assert(
    res5.relevantDocumentsFound === 0,
    "'Thủ đô của nước Pháp là gì?': relevantDocumentsFound === 0",
    `Kết quả: ${res5.relevantDocumentsFound} docs`
  );
  assert(
    res5.sources.length === 0,
    "'Thủ đô của nước Pháp là gì?': sources rỗng",
    `Số nguồn: ${res5.sources.length}`
  );
  assert(
    res5.answer.includes("Không tìm thấy thông tin liên quan"),
    "'Thủ đô của nước Pháp là gì?': Báo không tìm thấy thông tin trong kho DAU",
    `Câu trả lời: ${res5.answer}`
  );

  // TEST 6: Các câu hỏi cá nhân khác: "tôi là ai", "tôi vừa hỏi gì"
  console.log("\n-- TEST 6: CÂU HỎI 'tôi là ai' & 'tôi vừa hỏi gì' --");
  const res6a = await runRagPipeline("tôi là ai");
  const res6b = await runRagPipeline("tôi vừa hỏi gì");
  assert(
    res6a.relevantDocumentsFound === 0 && res6a.sources.length === 0,
    "'tôi là ai': Không gắn context rác",
    `Nguồn: ${res6a.sources.length}`
  );
  assert(
    res6b.relevantDocumentsFound === 0 && res6b.sources.length === 0,
    "'tôi vừa hỏi gì': Không gắn context rác",
    `Nguồn: ${res6b.sources.length}`
  );

  // TEST 7: Keyword Gating unit test
  console.log("\n-- TEST 7: KEYWORD GATING UNIT TEST --");
  const kw1 = extractKeywords("tôi tên gì");
  const kw2 = extractKeywords("liên quan gì");
  const kw3 = extractKeywords("thời tiết hôm nay thế nào");
  const kw4 = extractKeywords("học phí học lại bao nhiêu");
  assert(
    kw1.length === 0,
    "extractKeywords('tôi tên gì') === [] (Không tạo từ khóa rác)",
    `Từ khóa: ${JSON.stringify(kw1)}`
  );
  assert(
    kw2.length === 0,
    "extractKeywords('liên quan gì') === [] (Không tạo từ khóa rác)",
    `Từ khóa: ${JSON.stringify(kw2)}`
  );
  assert(
    kw3.length === 0,
    "extractKeywords('thời tiết hôm nay thế nào') === []",
    `Từ khóa: ${JSON.stringify(kw3)}`
  );
  assert(
    kw4.includes("học phí") && kw4.includes("học lại"),
    "extractKeywords('học phí học lại bao nhiêu') giữ nguyên cụm từ miền DAU",
    `Từ khóa: ${JSON.stringify(kw4)}`
  );

  console.log("\n============================================================");
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASSED / ${failedTests} FAILED`);
  console.log("============================================================\n");

  if (failedTests > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});

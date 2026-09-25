import { extractKeywords, scorePageRelevance, retrieveRelevantChunks, chunksToSources } from "@/lib/ai/retrieval";
import { buildContextFromChunks, buildUserPrompt } from "@/lib/ai/context_builder";
import { generateLocalExtractiveAnswer } from "@/lib/ai/provider";
import { Document } from "@/types/document";

/**
 * Bộ test kiểm tra 10 khía cạnh cốt lõi của Retrieval, Ranking, Context, Citation & No-hallucination
 */
export function runAITests() {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    results.push({ name, passed: Boolean(condition), details });
    if (!condition) {
      console.error(`[FAIL] ${name}: ${details}`);
    } else {
      console.log(`[PASS] ${name}`);
    }
  }

  // 1. Test Question validation & Keyword extraction
  const kw1 = extractKeywords("Học phí học kỳ 1 năm học 2026-2027 là bao nhiêu?");
  assert(
    "1. Keyword extraction captures essential academic keywords and years",
    kw1.includes("học phí") && (kw1.includes("2026-2027") || kw1.includes("học kỳ 1")),
    `Keywords: ${JSON.stringify(kw1)}`
  );

  // 2. Test Stopwords filter
  const kw2 = extractKeywords("là gì ở đâu khi nào trường đại học kiến trúc đà nẵng");
  assert(
    "2. Stopwords are filtered out cleanly",
    kw2.length === 0,
    `Keywords: ${JSON.stringify(kw2)}`
  );

  // 3. Test Document relevance scoring
  const mockDoc: Document = {
    id: "dau_doc_test",
    title: "Thông báo nộp học phí học kỳ 1 năm học 2026-2027",
    document_number: "34/TB-ĐHKTĐN",
    issue_date: "2026-08-03",
    issuing_unit: "Trường Đại học Kiến trúc Đà Nẵng",
    category: "Học phí",
    subcategory: "Thu học phí",
    deadline: null,
    effective_status: "unknown",
    effective_from: null,
    effective_to: null,
    replaced_by: null,
    source_url: "https://media.dau.edu.vn/doc.pdf",
    detail_url: "https://sinhvien.dau.edu.vn/doc.html",
    source_file: "doc.pdf",
    file_format: "pdf",
    total_pages: 1,
    content: "Sinh viên nộp học phí đúng hạn trước ngày 15/09/2026.",
    pages: [
      {
        page_number: 1,
        raw_text: "Sinh viên nộp học phí đúng hạn trước ngày 15/09/2026.",
        cleaned_text: "Sinh viên nộp học phí đúng hạn trước ngày 15/09/2026.",
      },
    ],
    attachments: [],
    metadata: {},
    provenance: {},
  };

  const score1 = scorePageRelevance(mockDoc, 1, mockDoc.pages[0].cleaned_text, ["học phí", "2026-2027"]);
  const scoreIrrelevant = scorePageRelevance(mockDoc, 1, mockDoc.pages[0].cleaned_text, ["bóng đá", "thời tiết"]);

  assert(
    "3. Relevant document receives substantially higher score than irrelevant terms",
    score1.score > 20 && scoreIrrelevant.score === 0,
    `Score relevant: ${score1.score}, Score irrelevant: ${scoreIrrelevant.score}`
  );

  // 4. Test Context building
  const mockChunks = [
    {
      documentId: mockDoc.id,
      title: mockDoc.title,
      documentNumber: mockDoc.document_number,
      issueDate: mockDoc.issue_date,
      category: mockDoc.category,
      pageNumber: 1,
      text: mockDoc.pages[0].cleaned_text,
      relevanceScore: score1.score,
      matchedKeywords: score1.matchedKeywords,
    },
  ];

  const contextStr = buildContextFromChunks(mockChunks);
  assert(
    "4. Context building contains document ID, title, and page metadata",
    contextStr.includes(mockDoc.id) && contextStr.includes(mockDoc.title) && contextStr.includes("TRANG: 1"),
    `Context: ${contextStr}`
  );

  // 5. Test Citation mapping
  const sources = chunksToSources(mockChunks, [mockDoc]);
  assert(
    "5. Citation sources correctly map URL to /documents/[id] with exact page number",
    sources.length === 1 && sources[0].url === `/documents/${mockDoc.id}` && sources[0].page === 1,
    `Source URL: ${sources[0]?.url}, Page: ${sources[0]?.page}`
  );

  // 6. Test No-hallucination when no relevant documents exist
  const emptyAnswer = generateLocalExtractiveAnswer("Một quy định hoàn toàn không có trong trường", [], []);
  assert(
    "6. No-hallucination: Returns transparent not found message when no chunks exist",
    emptyAnswer.includes("Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU"),
    `Answer: ${emptyAnswer}`
  );

  // 7. Test User prompt builder contains strict anti-hallucination constraints
  const userPrompt = buildUserPrompt("Học phí kỳ 1?", contextStr);
  assert(
    "7. User prompt strictly instructs model to answer only based on source documents",
    userPrompt.includes("HÃY TRẢ LỜI CÂU HỎI TRÊN DỰA HOÀN TOÀN VÀO CÁC VĂN BẢN NGUỒN Ở TRÊN"),
    `User prompt: ${userPrompt}`
  );

  // 8. Test Local extractive answer contains citation marker
  const answer = generateLocalExtractiveAnswer("Học phí", mockChunks, sources);
  assert(
    "8. Generated answer contains citation reference marker [Nguồn 1]",
    answer.includes("[Nguồn 1]"),
    `Answer: ${answer}`
  );

  // 9. Test Real retrieval from actual 10 sample documents
  const realChunks = retrieveRelevantChunks("học phí", 8.0, 3);
  assert(
    "9. Real dataset retrieval retrieves genuine tuition documents from 10 sample documents",
    realChunks.length > 0 && realChunks.some((c) => c.title.toLowerCase().includes("học phí")),
    `Retrieved chunks: ${realChunks.length}`
  );

  // 10. Test Exam review retrieval
  const examChunks = retrieveRelevantChunks("phúc khảo bài thi", 8.0, 3);
  assert(
    "10. Real dataset retrieval retrieves exam review documents for 'phúc khảo'",
    examChunks.length > 0 && examChunks.some((c) => c.title.toLowerCase().includes("phúc khảo")),
    `Retrieved exam chunks: ${examChunks.length}`
  );

  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`\n========================================`);
  console.log(`AI Q&A & RETRIEVAL TEST RESULTS: ${totalPassed}/${results.length} PASS`);
  console.log(`========================================\n`);

  return {
    total: results.length,
    passed: totalPassed,
    results,
  };
}

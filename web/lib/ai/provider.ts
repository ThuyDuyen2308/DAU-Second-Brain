import { RetrievedChunk, SourceReference } from "@/types/ask";
import { DAU_AI_SYSTEM_PROMPT, buildUserPrompt } from "./context_builder";

export interface AIProviderResponse {
  answer: string;
  modelUsed: string;
}

/**
 * Tra loi bang logic noi bo (Rule-based / Extractive Synthesizer) khi chua cau hinh API Key.
 * Trich xuat chinh xac cau tu tai lieu nguon that, tuyet doi khong bia dat.
 * v2: Loc dong OCR loi, mo rong context quanh dong matched, ho tro nhieu nguon.
 */
export function generateLocalExtractiveAnswer(
  question: string,
  chunks: RetrievedChunk[],
  sources: SourceReference[]
): string {
  if (!chunks.length || !sources.length) {
    return "Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU.";
  }

  /** Lọc bỏ dòng OCR lỗi / header / footer vô nghĩa trong văn bản hành chính */
  function isGarbageLine(line: string): boolean {
    if (line.length < 5) return true;
    // Dòng toàn chữ hoa Latin không dấu (header tiêu đề cơ quan bị OCR lỗi)
    if (/^[A-Z\s\.\-\/\\&()]+$/.test(line) && line.length < 60) return true;
    // Dòng footer quen thuộc trong văn bản hành chính
    if (/^(S6:|Luu:|PHO TRUONG|KT\.\s|Noi nhan|PHONG |Nguy[eê]n Thanh)/i.test(line)) return true;
    return false;
  }

  /** Lấy excerpt từ chunk: lọc OCR lỗi, expand context ±1-2 dòng quanh dòng keyword */
  function extractExcerptLines(chunk: RetrievedChunk, maxLines: number = 8): string[] {
    const allLines = chunk.text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 15 && !isGarbageLine(l));

    const keywords = (chunk.matchedKeywords || []).map((kw) => kw.toLowerCase());
    if (keywords.length === 0) return allLines.slice(0, maxLines);

    const matchedIndices: number[] = [];
    allLines.forEach((line, i) => {
      const lower = line.toLowerCase();
      if (keywords.some((kw) => lower.includes(kw))) matchedIndices.push(i);
    });

    if (matchedIndices.length === 0) return allLines.slice(0, maxLines);

    // Expand: lấy dòng matched ± context (1 trước, 2 sau) để câu không bị cắt ngang
    const selectedIndices = new Set<number>();
    for (const idx of matchedIndices) {
      for (let j = Math.max(0, idx - 1); j <= Math.min(allLines.length - 1, idx + 2); j++) {
        selectedIndices.add(j);
      }
      if (selectedIndices.size >= maxLines) break;
    }

    return Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map((i) => allLines[i]);
  }

  const primarySource = sources[0];
  const primaryChunk = chunks[0];
  const primaryLines = extractExcerptLines(primaryChunk, 8);

  // Thêm excerpt từ nguồn thứ 2 nếu có và khác nguồn 1
  let additionalInfo = "";
  if (chunks.length > 1 && sources.length > 1 && sources[1].documentId !== primarySource.documentId) {
    const secondLines = extractExcerptLines(chunks[1], 4);
    if (secondLines.length > 0) {
      const s2DocNum = sources[1].documentNumber ? ` (Số: ${sources[1].documentNumber})` : "";
      additionalInfo = `\n\n**Thông tin liên quan** theo **${sources[1].title}**${s2DocNum} [Nguồn 2]:\n- ${secondLines.join("\n- ")}`;
    }
  }

  const dateStr = primarySource.issueDate ? ` ngày ${primarySource.issueDate}` : "";
  const docNumStr = primarySource.documentNumber ? ` (Số: ${primarySource.documentNumber})` : "";
  const excerpt = primaryLines.length > 0 ? primaryLines.join("\n- ") : primaryChunk.text.slice(0, 500).trim();

  return `Theo **${primarySource.title}**${docNumStr}${dateStr} [Nguồn 1]:\n\n- ${excerpt}${additionalInfo}\n\n*(Thông tin được trích xuất trực tiếp từ kho văn bản đã chuẩn hóa của DAU)*.`;
}

/**
 * Gọi Google Gemini AI thật (hoặc fallback an toàn sang Local Extractive Synthesizer).
 * Tuân thủ tuyệt đối:
 * - Anti-hallucination (chỉ dùng context)
 * - Quota guard: timeout 15s, bắt mã lỗi 429/ResourceExhausted không retry vô hạn
 * - Không để Gemini tự bịa đặt citation
 */
export async function callAIModel(
  question: string,
  context: string,
  chunks: RetrievedChunk[],
  sources: SourceReference[]
): Promise<AIProviderResponse> {
  // Lấy API key từ biến môi trường (ưu tiên GEMINI_API_KEY)
  const geminiApiKey = process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith("AIza") ? process.env.AI_API_KEY : "");
  const openaiApiKey = process.env.OPENAI_API_KEY || (!geminiApiKey ? process.env.AI_API_KEY : "");

  // TRƯỜNG HỢP 1: Không có API key nào được cấu hình -> Fallback an toàn ngay lập tức
  if (!geminiApiKey && !openaiApiKey) {
    const localAnswer = generateLocalExtractiveAnswer(question, chunks, sources);
    return {
      answer: localAnswer,
      modelUsed: "DAU Local Extractive Synthesizer (No API Key configured)",
    };
  }

  // TRƯỜNG HỢP 2: Có Google Gemini API Key
  if (geminiApiKey) {
    const modelName = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

    try {
      const userPrompt = buildUserPrompt(question, context);

      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${DAU_AI_SYSTEM_PROMPT}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[Gemini API HTTP ${response.status}] ${errorText.slice(0, 200)}`);

        if (response.status === 429) {
          console.warn("[Gemini API] Quota exceeded or rate limited (429). Fallback to local synthesizer.");
        }

        return {
          answer: generateLocalExtractiveAnswer(question, chunks, sources),
          modelUsed: `DAU Extractive Fallback (Gemini API error: ${response.status})`,
        };
      }

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText && generatedText.trim().length > 0) {
        return {
          answer: generatedText.trim(),
          modelUsed: `Google Gemini (${modelName})`,
        };
      }
    } catch (err: any) {
      if (err?.name === "TimeoutError") {
        console.warn("[Gemini API] Request timeout (15s). Fallback to local synthesizer.");
      } else {
        console.warn("[Gemini API] Connection error:", err?.message || err);
      }

      return {
        answer: generateLocalExtractiveAnswer(question, chunks, sources),
        modelUsed: "DAU Extractive Fallback (Gemini API timeout or network error)",
      };
    }
  }

  // TRƯỜNG HỢP 3: Có OpenAI Compatible Key
  if (openaiApiKey) {
    try {
      const endpoint = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";
      const modelName = process.env.AI_MODEL || "gpt-4o-mini";
      const userPrompt = buildUserPrompt(question, context);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.1,
          messages: [
            { role: "system", content: DAU_AI_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return {
            answer: content.trim(),
            modelUsed: `OpenAI (${modelName})`,
          };
        }
      }
    } catch (err) {
      console.warn("[OpenAI Provider Error]", err);
    }
  }

  // Fallback mặc định
  return {
    answer: generateLocalExtractiveAnswer(question, chunks, sources),
    modelUsed: "DAU Local Extractive Synthesizer (Fallback)",
  };
}
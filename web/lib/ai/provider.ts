import { RetrievedChunk, SourceReference } from "@/types/ask";
import { DAU_AI_SYSTEM_PROMPT, buildUserPrompt } from "./context_builder";

export interface AIProviderResponse {
  answer: string;
  modelUsed: string;
}

/**
 * Trả lời bằng logic nội bộ (Rule-based / Extractive Synthesizer) khi chưa cấu hình API Key.
 * Trích xuất chính xác câu từ tài liệu nguồn thật, tuyệt đối không bịa đặt.
 */
export function generateLocalExtractiveAnswer(
  question: string,
  chunks: RetrievedChunk[],
  sources: SourceReference[]
): string {
  if (!chunks.length || !sources.length) {
    return "Tôi chưa tìm thấy thông tin phù hợp trong dữ liệu văn bản hiện có của DAU.";
  }

  const primarySource = sources[0];
  const primaryChunk = chunks[0];

  // Tìm các câu chứa từ khóa chính trong chunk hàng đầu
  const lines = primaryChunk.text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20);

  const matchedLines: string[] = [];
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const hasKeyword = (primaryChunk.matchedKeywords || []).some((kw) =>
      lineLower.includes(kw.toLowerCase())
    );
    if (hasKeyword && !matchedLines.includes(line)) {
      matchedLines.push(line);
      if (matchedLines.length >= 3) break;
    }
  }

  let excerpt = "";
  if (matchedLines.length > 0) {
    excerpt = matchedLines.join("\n- ");
  } else {
    excerpt = primaryChunk.text.slice(0, 300).trim() + "...";
  }

  const dateStr = primarySource.issueDate ? ` ngày ${primarySource.issueDate}` : "";
  const docNumStr = primarySource.documentNumber ? ` (Số: ${primarySource.documentNumber})` : "";

  return `Theo **${primarySource.title}**${docNumStr}${dateStr} [Nguồn 1]:\n\n- ${excerpt}\n\n*(Thông tin được trích xuất trực tiếp từ kho văn bản đã chuẩn hóa của DAU)*.`;
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
          temperature: 0.1, // Rất thấp để hạn chế tối đa hallucination
          maxOutputTokens: 1024,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000), // Timeout 15s tránh treo request
      });

      // Xử lý các mã lỗi cụ thể từ Google Gemini API
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.warn(`[Gemini API HTTP ${response.status}] ${errorText.slice(0, 200)}`);

        if (response.status === 429) {
          console.warn("[Gemini API] Quota exceeded or rate limited (429). Fallback to local synthesizer.");
        }

        // Fallback an toàn ngay lập tức, không retry vô hạn gây kiệt quota
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

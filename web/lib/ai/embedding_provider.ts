/**
 * Tính Cosine Similarity giữa hai vector số thực
 * Giá trị trả về từ -1.0 đến 1.0 (thường từ 0 đến 1 đối với embeddings văn bản)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, sim));
}

export interface IEmbeddingProvider {
  name: string;
  isAvailable(): boolean;
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Gemini Embedding Provider (text-embedding-004)
 */
export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  name = "gemini-text-embedding-004";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "text-embedding-004") {
    this.apiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY ||
      "";
    this.model = model;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error("Gemini API key is not configured.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text: text.slice(0, 4000) }] },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Gemini Embedding error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data?.embedding?.values || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const vec = await this.embedText(text);
      results.push(vec);
    }
    return results;
  }
}

/**
 * OpenAI Compatible Embedding Provider (text-embedding-3-small)
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  name = "openai-text-embedding-3-small";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model = "text-embedding-3-small", baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model;
    this.baseUrl = baseUrl;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async embedText(text: string): Promise<number[]> {
    const res = await this.embedBatch([text]);
    return res[0] || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isAvailable()) {
      throw new Error("OpenAI API key is not configured.");
    }

    const endpoint = `${this.baseUrl}/embeddings`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((t) => t.slice(0, 4000)),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`OpenAI Embedding error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return (data?.data || []).map((item: any) => item.embedding);
  }
}

/**
 * Factory lấy provider embedding khả dụng đầu tiên
 */
export function getAvailableEmbeddingProvider(): IEmbeddingProvider | null {
  const gemini = new GeminiEmbeddingProvider();
  if (gemini.isAvailable()) return gemini;

  const openai = new OpenAIEmbeddingProvider();
  if (openai.isAvailable()) return openai;

  return null;
}

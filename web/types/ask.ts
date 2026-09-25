export interface SourceReference {
  documentId: string;
  title: string;
  documentNumber: string | null;
  issueDate: string | null;
  category: string | null;
  page: number;
  snippet: string;
  url: string;
  sourceUrl?: string | null;
}

export interface AskRequest {
  question: string;
}

export interface AskResponse {
  answer: string;
  sources: SourceReference[];
  relevantDocumentsFound: number;
  modelUsed?: string;
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  documentNumber: string | null;
  issueDate: string | null;
  category: string | null;
  pageNumber: number;
  text: string;
  relevanceScore: number;
  matchedKeywords: string[];
  // Các trường mở rộng cho Bước 9: Semantic & Hybrid Search
  keywordScore?: number;
  semanticScore?: number;
  finalScore?: number;
  chunkId?: string;
}

export interface EmbeddedChunkItem {
  chunkId: string;
  documentId: string;
  title: string;
  documentNumber: string | null;
  issueDate: string | null;
  category: string | null;
  pageNumber: number;
  text: string;
  embedding: number[];
}

export interface EmbeddingIndex {
  model: string;
  createdAt: string;
  totalChunks: number;
  chunks: EmbeddedChunkItem[];
}

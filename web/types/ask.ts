// web/types/ask.ts
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

// -----------------------------------------------------------------------------
// Types cho Lịch sử Chat & Cuộc trò chuyện (Bước 15)
// -----------------------------------------------------------------------------
export type ChatRole = "user" | "assistant";

export interface ChatCitation {
  documentId: string;
  title: string;
  documentNumber?: string | null;
  pageNumber?: number;
  snippet?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  citations?: ChatCitation[];
  modelUsed?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

// types/admin.ts

export interface AdminDocumentItem {
  id: string;
  title: string;
  documentNumber: string | null;
  issueDate: string | null;
  category: string | null;
  totalPages: number;
  chunkCount: number;
  processingStatus: "processed" | "unprocessed";
  effectiveStatus: string;
  sourceUrl?: string;
  detailUrl?: string;
}

export interface AdminCategoryItem {
  name: string;
  count: number;
  subcategories: string[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Sinh viên";
  status: "Hoạt động" | "Tạm khóa";
  createdAt: string;
}

export interface AdminQuestionLogItem {
  id: string;
  question: string;
  timestamp: string;
  sourcesCount: number;
  modelUsed: string;
  status: "Thành công" | "Từ chối an toàn" | "Lỗi";
  isDemo: boolean;
}

export interface PipelineStageInfo {
  id: string;
  name: string;
  description: string;
  status: "deployed" | "architecture_only" | "not_configured" | "offline_ready";
  statusLabel: string;
  details: string;
}

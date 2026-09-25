export interface DocumentPage {
  page_number: number;
  raw_text: string;
  cleaned_text: string;
}

export interface DocumentMetadata {
  crawled_at?: string;
  crawl_status?: string;
  content_source?: string;
  raw_issue_date?: string;
  ocr_quality?: {
    score?: number;
    label?: string;
    warnings?: string[];
    metrics?: Record<string, any>;
  };
}

export interface DocumentProvenance {
  notification_index?: number;
  notification_title?: string;
  detail_file?: string | null;
  document_file?: string | null;
  extracted_file?: string | null;
}

export interface Document {
  id: string;
  title: string;
  document_number: string | null;
  issue_date: string | null;
  issuing_unit: string | null;
  category: string | null;
  subcategory: string | null;
  deadline: string | null;
  effective_status: "unknown" | "effective" | "expired" | string;
  effective_from: string | null;
  effective_to: string | null;
  replaced_by: string | null;
  source_url: string;
  detail_url: string;
  source_file: string;
  file_format: string;
  total_pages: number;
  content: string;
  pages: DocumentPage[];
  attachments: string[];
  metadata: DocumentMetadata;
  provenance: DocumentProvenance;
}

export interface CategoryStats {
  name: string;
  count: number;
  subcategories: string[];
}

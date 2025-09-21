export interface CSVRow {
  id: string;
  originalData: Record<string, string>;
  url: string;
  opener?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobData {
  jobId: string;
  fileName: string;
  urlColumn: string;
  contentType: 'company' | 'person' | 'news';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface ProcessedCSVRow {
  original_row_id: string;
  original_url: string;
  opener_text: string;
  status: string;
  error_message?: string;
}

export interface UploadResponse {
  jobId: string;
  fileName: string;
  totalRows: number;
  preview: CSVRow[];
  columns: string[];
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  progress: {
    total: number;
    processed: number;
    failed: number;
    pending: number;
  };
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface OpenAIResponse {
  opener: string;
  tokensUsed: number;
}

export type ContentType = 'company' | 'person' | 'news';

export interface PromptTemplate {
  system: string;
  user: string;
}


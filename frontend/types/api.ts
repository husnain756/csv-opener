// API Response Types
export interface Job {
  id: string
  file_name: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_rows: number
  processed_rows: number
  failed_rows: number
  created_at: string
  updated_at: string
  progress: string
}

export interface JobDetails {
  jobId: string
  status: string
  progress: {
    total: number
    processed: number
    failed: number
    pending: number
    status: string
  }
  fileName: string
  totalRows: number
  processedRows: number
  failedRows: number
  createdAt: string
  updatedAt: string
}

export interface UrlRecord {
  id: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  opener?: string
  error?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface JobResults {
  urls: UrlRecord[]
}

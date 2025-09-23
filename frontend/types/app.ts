// Application Types
export type ContentType = 'company' | 'person' | 'news'

export type AppStep = 'upload' | 'preview' | 'processing' | 'results'

export interface CSVRow {
  id: string
  originalData: Record<string, any>
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  opener?: string
  error?: string
  retryCount: number
  createdAt: string
  updatedAt: string
  [key: string]: any // Allow string indexing
}

export interface JobResult {
  url: string
  opener: string
  status: 'completed' | 'failed'
  error?: string
}

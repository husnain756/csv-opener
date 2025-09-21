export interface CSVRow {
  [key: string]: string
}

export interface JobResult {
  rowId: string
  url: string
  opener?: string
  status: 'success' | 'failed' | 'pending'
  error?: string
  retryCount?: number
}

export type ContentType = 'company' | 'linkedin' | 'news' | ''

export type AppStep = 'upload' | 'preview' | 'processing' | 'results'

export interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    completed: number
    failed: number
    pending: number
  }
  results: JobResult[]
  error?: string
  estimatedTimeRemaining?: number
  cost?: {
    tokensUsed: number
    estimatedCost: number
  }
}

export interface ProcessingSettings {
  model: string
  temperature: number
  maxTokens: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  enableCostTracking: boolean
  enableDetailedLogs: boolean
}

export interface UploadResponse {
  success: boolean
  data?: CSVRow[]
  error?: string
  validation?: {
    isValid: boolean
    errors: string[]
    warnings: string[]
    urlColumns: string[]
    rowCount: number
  }
}

export interface ProcessJobRequest {
  csvData: CSVRow[]
  urlColumn: string
  contentType: ContentType
  settings: Partial<ProcessingSettings>
}

export interface ProcessJobResponse {
  success: boolean
  jobId?: string
  error?: string
}

export interface PromptTemplate {
  company: string
  linkedin: string
  news: string
}

export const PROMPT_TEMPLATES: PromptTemplate = {
  company: `You are a professional outreach assistant. Given only this URL, write a tasteful, non-salesy 1–2 sentence opener suitable for a first outreach message to a company. Maximum 40 words. Tone: professional, helpful.

{url}`,

  linkedin: `You are a professional networking assistant. Based on the URL context below, write a concise (≤40 words) opener to start a LinkedIn message. Keep it respectful and personalized; do not invent sensitive personal info.

{url}`,

  news: `You are writing a short 1–2 sentence summary/opener for a community/news page. Keep it factual and under 40 words.

{url}`
}

export interface CostEstimate {
  tokensPerRequest: number
  costPerToken: number
  estimatedCostPer1000: number
  model: string
}

export const COST_ESTIMATES: Record<string, CostEstimate> = {
  'gpt-3.5-turbo': {
    tokensPerRequest: 50,
    costPerToken: 0.0000015,
    estimatedCostPer1000: 0.075,
    model: 'gpt-3.5-turbo'
  },
  'gpt-4': {
    tokensPerRequest: 50,
    costPerToken: 0.00003,
    estimatedCostPer1000: 1.5,
    model: 'gpt-4'
  },
  'gpt-4-turbo': {
    tokensPerRequest: 50,
    costPerToken: 0.00001,
    estimatedCostPer1000: 0.5,
    model: 'gpt-4-turbo'
  }
}

export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Date
}

export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  errors?: ValidationError[]
  timestamp: string
}

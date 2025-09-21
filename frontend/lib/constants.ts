export const APP_CONFIG = {
  name: 'CSV Opener',
  description: 'Generate professional outreach openers from CSV URLs using OpenAI',
  version: '1.0.0',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxRows: 50000,
  defaultConcurrency: 10,
  pollingInterval: 2000,
} as const

export const CONTENT_TYPES = [
  { key: 'company', label: 'Company', description: 'Business websites and company pages' },
  { key: 'linkedin', label: 'LinkedIn/Person', description: 'LinkedIn profiles and personal pages' },
  { key: 'news', label: 'News/Community', description: 'News articles and community content' }
] as const

export const PROMPT_TEMPLATES = {
  company: `You are a professional outreach assistant. Given only this URL, write a tasteful, non-salesy 1–2 sentence opener suitable for a first outreach message to a company. Maximum 40 words. Tone: professional, helpful.

{url}`,

  linkedin: `You are a professional networking assistant. Based on the URL context below, write a concise (≤40 words) opener to start a LinkedIn message. Keep it respectful and personalized; do not invent sensitive personal info.

{url}`,

  news: `You are writing a short 1–2 sentence summary/opener for a community/news page. Keep it factual and under 40 words.

{url}`
} as const

export const MODEL_OPTIONS = [
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
  { key: 'gpt-4', label: 'GPT-4', description: 'Higher quality, more expensive' },
  { key: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Latest model with improved performance' }
] as const

export const COST_ESTIMATES = {
  'gpt-3.5-turbo': {
    tokensPerRequest: 50,
    costPerToken: 0.0000015,
    estimatedCostPer1000: 0.075,
  },
  'gpt-4': {
    tokensPerRequest: 50,
    costPerToken: 0.00003,
    estimatedCostPer1000: 1.5,
  },
  'gpt-4-turbo': {
    tokensPerRequest: 50,
    costPerToken: 0.00001,
    estimatedCostPer1000: 0.5,
  }
} as const

export const API_ENDPOINTS = {
  upload: '/api/upload',
  process: '/api/process',
  jobs: (id: string) => `/api/jobs/${id}`,
  download: (id: string) => `/api/jobs/${id}/download`,
  retry: (id: string) => `/api/jobs/${id}/retry`,
  cancel: (id: string) => `/api/jobs/${id}/cancel`,
} as const

export const STORAGE_KEYS = {
  settings: 'csv-opener-settings',
  appState: 'csv-opener-storage',
  theme: 'theme',
} as const


import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CSVRow, JobResult, ContentType, AppStep } from '@/types'

interface AppState {
  // Current step in the process
  currentStep: AppStep
  
  // CSV data
  csvData: CSVRow[] | null
  selectedColumn: string | null
  
  // Processing configuration
  contentType: ContentType
  
  // Job tracking
  jobId: string | null
  jobStatus: 'pending' | 'processing' | 'completed' | 'failed' | null
  results: JobResult[] | null
  
  // Error handling
  error: string | null
  
  // Actions
  setCurrentStep: (step: AppStep) => void
  setCsvData: (data: CSVRow[] | null) => void
  setSelectedColumn: (column: string | null) => void
  setContentType: (type: ContentType) => void
  setJobId: (id: string | null) => void
  setJobStatus: (status: 'pending' | 'processing' | 'completed' | 'failed' | null) => void
  setResults: (results: JobResult[] | null) => void
  setError: (error: string | null) => void
  resetApp: () => void
}

const initialState = {
  currentStep: 'upload' as AppStep,
  csvData: null,
  selectedColumn: null,
  contentType: '' as ContentType,
  jobId: null,
  jobStatus: null,
  results: null,
  error: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setCurrentStep: (step) => set({ currentStep: step }),
      setCsvData: (data) => set({ csvData: data }),
      setSelectedColumn: (column) => set({ selectedColumn: column }),
      setContentType: (type) => set({ contentType: type }),
      setJobId: (id) => set({ jobId: id }),
      setJobStatus: (status) => set({ jobStatus: status }),
      setResults: (results) => set({ results }),
      setError: (error) => set({ error }),
      
      resetApp: () => set(initialState),
    }),
    {
      name: 'csv-opener-storage',
      partialize: (state) => ({
        contentType: state.contentType,
      }),
    }
  )
)

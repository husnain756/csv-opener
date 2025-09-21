import { useState, useEffect, useCallback, useRef } from 'react'

export interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    total: number
    completed: number
    failed: number
    pending: number
  }
  results: Array<{
    rowId: string
    url: string
    opener?: string
    status: 'success' | 'failed' | 'pending'
    error?: string
    retryCount?: number
  }>
  error?: string
  estimatedTimeRemaining?: number
  cost?: {
    tokensUsed: number
    estimatedCost: number
  }
}

interface UseJobPollingOptions {
  jobId: string | null
  enabled?: boolean
  interval?: number
  onStatusChange?: (status: JobStatus) => void
  onComplete?: (status: JobStatus) => void
  onError?: (error: string) => void
}

export function useJobPolling({
  jobId,
  enabled = true,
  interval = 2000,
  onStatusChange,
  onComplete,
  onError
}: UseJobPollingOptions) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const pollJob = useCallback(async () => {
    if (!jobId || !enabled) return

    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: JobStatus = await response.json()
      setJobStatus(data)
      setError(null)
      
      onStatusChange?.(data)

      if (data.status === 'completed' || data.status === 'failed') {
        setIsPolling(false)
        onComplete?.(data)
        
        if (data.status === 'failed') {
          onError?.(data.error || 'Job failed')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      setIsPolling(false)
    }
  }, [jobId, enabled, onStatusChange, onComplete, onError])

  const startPolling = useCallback(() => {
    if (!jobId || isPolling) return

    setIsPolling(true)
    setError(null)
    
    // Poll immediately
    pollJob()
    
    // Set up interval
    intervalRef.current = setInterval(pollJob, interval)
  }, [jobId, isPolling, pollJob, interval])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const retryJob = useCallback(async (rowIds?: string[]) => {
    if (!jobId) return false

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds })
      })

      if (response.ok) {
        setIsPolling(true)
        setError(null)
        return true
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry job'
      setError(errorMessage)
      onError?.(errorMessage)
      return false
    }
  }, [jobId, onError])

  const cancelJob = useCallback(async () => {
    if (!jobId) return false

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        stopPolling()
        return true
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel job'
      setError(errorMessage)
      onError?.(errorMessage)
      return false
    }
  }, [jobId, stopPolling, onError])

  // Auto-start polling when jobId changes
  useEffect(() => {
    if (jobId && enabled) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => stopPolling()
  }, [jobId, enabled, startPolling, stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    jobStatus,
    isPolling,
    error,
    startPolling,
    stopPolling,
    retryJob,
    cancelJob,
    pollJob
  }
}

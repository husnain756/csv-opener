import { useState, useEffect, useRef, useCallback } from 'react'

interface JobProgressUpdate {
  jobId: string
  status: 'processing' | 'completed' | 'failed' | 'stopped'
  progress: {
    total: number
    completed: number
    failed: number
    pending: number
  }
  currentUrl?: string
}

interface JobManagementSSE {
  jobProgress: Record<string, JobProgressUpdate>
  isConnected: boolean
  error: string | null
  refreshConnections: () => void
}

export function useJobManagementSSE(jobIds: string[]): JobManagementSSE {
  const [jobProgress, setJobProgress] = useState<Record<string, JobProgressUpdate>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())
  const isInitializedRef = useRef(false)

  // Memoize the jobIds to prevent unnecessary re-renders
  const memoizedJobIds = useRef<string[]>([])

  const closeAllConnections = useCallback(() => {
    console.log('Closing all SSE connections')
    eventSourcesRef.current.forEach((eventSource, jobId) => {
      console.log(`Closing SSE connection for job ${jobId}`)
      eventSource.close()
    })
    eventSourcesRef.current.clear()
    setIsConnected(false)
  }, [])

  const createConnection = useCallback((jobId: string, forceReconnect = false) => {
    if (eventSourcesRef.current.has(jobId) && !forceReconnect) {
      console.log(`SSE connection already exists for job ${jobId}`)
      return
    }

    // Close existing connection if force reconnecting
    if (forceReconnect && eventSourcesRef.current.has(jobId)) {
      console.log(`Force reconnecting SSE for job ${jobId}`)
      const existingConnection = eventSourcesRef.current.get(jobId)
      if (existingConnection) {
        existingConnection.close()
        eventSourcesRef.current.delete(jobId)
      }
    }

    console.log(`Creating SSE connection for job ${jobId}`)
    const eventSource = new EventSource(`http://localhost:3001/api/jobs/${jobId}/stream`)
    
    eventSource.onopen = () => {
      console.log(`SSE connection opened for job ${jobId}`)
      setIsConnected(true)
      setError(null)
    }

    eventSource.onmessage = (event) => {
      try {
        const update: JobProgressUpdate = JSON.parse(event.data)
        console.log(`SSE update received for job ${update.jobId}:`, update)
        
        setJobProgress(prev => ({
          ...prev,
          [update.jobId]: update
        }))
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }

    eventSource.onerror = (error) => {
      console.error(`SSE connection error for job ${jobId}:`, error)
      setError(`Connection error for job ${jobId}`)
      setIsConnected(false)
      // Close the connection on error to prevent retries
      eventSource.close()
      eventSourcesRef.current.delete(jobId)
    }

    eventSourcesRef.current.set(jobId, eventSource)
  }, [])

  useEffect(() => {
    // Check if jobIds have actually changed
    const jobIdsChanged = JSON.stringify(jobIds) !== JSON.stringify(memoizedJobIds.current)
    
    if (!jobIdsChanged && isInitializedRef.current) {
      console.log('Job IDs unchanged, skipping SSE connection update')
      return
    }

    console.log('Job IDs changed, updating SSE connections:', jobIds)
    memoizedJobIds.current = [...jobIds]
    isInitializedRef.current = true

    if (jobIds.length === 0) {
      closeAllConnections()
      return
    }

    // Close connections for jobs that are no longer in the list
    eventSourcesRef.current.forEach((eventSource, jobId) => {
      if (!jobIds.includes(jobId)) {
        console.log(`Closing SSE connection for job ${jobId} (no longer needed)`)
        eventSource.close()
        eventSourcesRef.current.delete(jobId)
      }
    })

    // Create new connections for jobs that don't have connections
    jobIds.forEach(jobId => {
      createConnection(jobId)
    })

    return () => {
      // Only close connections on unmount, not on every effect run
      if (!isInitializedRef.current) {
        closeAllConnections()
      }
    }
  }, [jobIds, closeAllConnections, createConnection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting, closing all SSE connections')
      closeAllConnections()
    }
  }, [closeAllConnections])

  const refreshConnections = useCallback(() => {
    console.log('Refreshing all SSE connections')
    jobIds.forEach(jobId => {
      createConnection(jobId, true) // Force reconnect
    })
  }, [jobIds, createConnection])

  return {
    jobProgress,
    isConnected,
    error,
    refreshConnections
  }
}

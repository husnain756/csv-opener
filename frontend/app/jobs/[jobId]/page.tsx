'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Card, 
  CardBody, 
  CardHeader,
  Button, 
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Progress,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@nextui-org/react'
import { 
  Download, 
  RefreshCw, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  ArrowLeft,
  Eye
} from 'lucide-react'
import { jobService } from '@/services'
import { useJobManagementSSE } from '@/hooks'

interface Job {
  id: string
  file_name: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'stopped'
  total_rows: number
  processed_rows: number
  failed_rows: number
  created_at: string
  updated_at: string
  progress: string
}

interface JobResult {
  id: string
  url: string
  status: 'completed' | 'failed'
  opener?: string
  error?: string
  retry_count: number
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string
  
  const [job, setJob] = useState<Job | null>(null)
  const [results, setResults] = useState<JobResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen: isRetryModalOpen, onOpen: onRetryModalOpen, onClose: onRetryModalClose } = useDisclosure()

  // Use SSE for real-time updates
  const { jobProgress, isConnected, error: sseError, refreshConnections } = useJobManagementSSE(jobId ? [jobId] : [])

  // Update job with real-time SSE data
  useEffect(() => {
    if (jobProgress[jobId]) {
      const progress = jobProgress[jobId]
      setJob(prevJob => {
        if (!prevJob) return prevJob
        return {
          ...prevJob,
          status: progress.status,
          processed_rows: progress.progress.completed,
          failed_rows: progress.progress.failed,
          progress: `${progress.progress.completed}/${progress.progress.total}`
        }
      })
    }
  }, [jobProgress, jobId])

  useEffect(() => {
    if (jobId) {
      fetchJobDetails()
      fetchResults()
    }
  }, [jobId])

  // Real-time results updates during processing
  useEffect(() => {
    if (!job || job.status !== 'processing') return

    const interval = setInterval(() => {
      fetchResults()
    }, 2000) // Poll every 2 seconds during processing

    return () => clearInterval(interval)
  }, [job?.status])

  const fetchJobDetails = async () => {
    try {
      setLoading(true)
      const data = await jobService.getAllJobs()
      const jobData = data.find((j: Job) => j.id === jobId)
      if (jobData) {
        setJob(jobData)
      } else {
        setError('Job not found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job details')
    } finally {
      setLoading(false)
    }
  }

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/results`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.urls || [])
      }
    } catch (err) {
      console.error('Failed to fetch results:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-default-500" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />
      case 'failed': return <XCircle className="w-4 h-4 text-danger" />
      case 'stopped': return <AlertCircle className="w-4 h-4 text-warning" />
      default: return <Clock className="w-4 h-4 text-default-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default'
      case 'processing': return 'primary'
      case 'completed': return 'success'
      case 'failed': return 'danger'
      case 'stopped': return 'warning'
      default: return 'default'
    }
  }

  const handleRetryJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        await fetchJobDetails()
        await fetchResults()
        onRetryModalClose()
      }
    } catch (err) {
      setError('Failed to retry job')
    }
  }

  const handleDownloadResults = async () => {
    try {
      const blob = await jobService.downloadResults(jobId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${job?.file_name}-results.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download results')
    }
  }

  const handleStopJob = async () => {
    try {
      await jobService.stopJob(jobId)
      refreshConnections()
      setTimeout(async () => {
        await fetchJobDetails()
        await fetchResults()
      }, 100)
      setError(null)
    } catch (err) {
      setError('Failed to stop job')
    }
  }

  const handleResumeJob = async () => {
    try {
      await jobService.resumeJob(jobId)
      refreshConnections()
      setTimeout(async () => {
        await fetchJobDetails()
        await fetchResults()
      }, 100)
      setError(null)
    } catch (err) {
      setError('Failed to resume job')
    }
  }

  const handleDownloadOriginalFile = async () => {
    try {
      const blob = await jobService.downloadOriginalFile(jobId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = job?.file_name || 'original-file.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download file')
    }
  }

  const progressPercentage = (job: Job) => {
    if (job.total_rows === 0) return 0
    return Math.round((job.processed_rows / job.total_rows) * 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Card className="card-bubbly">
          <CardBody className="p-8 text-center">
            <XCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-default-500 mb-4">{error || 'Job not found'}</p>
            <Button
              color="primary"
              onPress={() => router.push('/jobs')}
              startContent={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Jobs
            </Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <main className="container mx-auto px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              isIconOnly
              variant="ghost"
              onPress={() => router.push('/jobs')}
              className="hover:bg-secondary/50 rounded-bubbly"
              aria-label="Go back to jobs page"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Job Details</h1>
              <div className="flex items-center gap-3">
                <p className="text-base text-foreground/70">{job.file_name}</p>
                <Button
                  size="sm"
                  color="primary"
                  variant="bordered"
                  startContent={<Download className="w-4 h-4" />}
                  onPress={handleDownloadOriginalFile}
                  className="rounded-bubbly"
                  title="Download Original File"
                >
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Job Status Card */}
        <Card className="card-bubbly mb-8">
          <CardBody className="p-6">
            {/* <div className="flex items-center gap-3 mb-6">
              {isConnected && (
                <Chip
                  size="sm"
                  color="success"
                  variant="flat"
                  startContent={<div className="w-2 h-2 bg-success rounded-full animate-pulse" />}
                >
                  Live
                </Chip>
              )}
              {sseError && (
                <Chip
                  size="sm"
                  color="danger"
                  variant="flat"
                  startContent={<XCircle className="w-3 h-3" />}
                >
                  Connection Error
                </Chip>
              )}
            </div> */}

            {/* Job Status and Details */}
            <div className="space-y-4">
              {/* Job Status as h2 */}
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Job Status: 
                <div className="flex items-center gap-2">
                  {getStatusIcon(job.status)}
                  <span className="text-xl font-semibold text-foreground">{job.status}</span>
                </div>
              </h2>
              
              {/* Progress Bar with Action Buttons */}
              {job.status !== 'completed' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  {job.status === 'processing' && (
                      <Button
                        size="sm"
                        color="danger"
                        variant="bordered"
                        onPress={handleStopJob}
                        className="rounded-bubbly"
                      >
                        Stop
                      </Button>
                    )}
                    {job.status === 'stopped' && (
                      <Button
                        size="sm"
                        color="success"
                        variant="bordered"
                        onPress={handleResumeJob}
                        className="rounded-bubbly"
                      >
                        Resume
                      </Button>
                    )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary-600 drop-shadow-sm">
                        {progressPercentage(job)}%
                      </span>
                  </div>
                </div>
               
                  <div className="relative mt-2">
                    <div className="w-full bg-gradient-to-br from-primary-100 to-primary-300 dark:from-primary-900/30 dark:to-primary-600/30 rounded-bubbly h-3 shadow-bubbly">
                      <div 
                        className={`h-3 rounded-bubbly transition-all duration-500 ${
                          job.status === 'processing' ? 'bg-gradient-to-r from-primary-200 to-primary-600 shadow-lg shadow-primary-500/50' : 
                          'bg-gradient-to-r from-gray-200 to-gray-500'
                        }`}
                        style={{ width: `${progressPercentage(job)}%` }}
                      ></div>
                    </div>
                  </div>
              </div>
                )}

              {/* Total URLs */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-default-600">Total URLs:</span>
                <span className="text-sm font-semibold">{job.total_rows}</span>
              </div>

              {/* Completed */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-default-600">Completed:</span>
                <span className="text-sm font-semibold text-success">{job.processed_rows}</span>
              </div>

              {/* Failed */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-default-600">Failed:</span>
                <span className="text-sm font-semibold text-danger">{job.failed_rows}</span>
              </div>

              {/* Last Updated */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-default-600">Last updated:</span>
                <span className="text-sm text-default-500">{new Date(job.updated_at).toLocaleString()}</span>
              </div>

              {/* Progress Bar - Only show if job is processing */}
              {/* {job.status === 'processing' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-default-500">{progressPercentage(job)}%</span>
                  </div>
                  <Progress 
                    value={progressPercentage(job)} 
                    color="primary"
                    size="lg"
                  />
                </div>
              )} */}
            </div>
          </CardBody>
        </Card>

        {/* Results Table */}
        <Card className="card-bubbly">
          <CardHeader className="card-header-shadow p-4">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-xl font-semibold">Results</h2>
              <div className="flex items-center gap-2">
                {job.status === 'completed' && (
                  <Button
                    color="primary"
                    variant="bordered"
                    startContent={<Download className="w-4 h-4" />}
                    onPress={handleDownloadResults}
                    className="rounded-bubbly"
                  >
                    Download Results
                  </Button>
                )}
                {job.status === 'failed' && (
                  <Button
                    color="warning"
                    variant="bordered"
                    startContent={<Play className="w-4 h-4" />}
                    onPress={onRetryModalOpen}
                    className="rounded-bubbly"
                  >
                    Retry Job
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {results.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-default-500">No results available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Results table">
                  <TableHeader>
                    <TableColumn>URL</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>OPENER</TableColumn>
                    <TableColumn>ERROR</TableColumn>
                    <TableColumn>RETRIES</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="max-w-xs truncate" title={result.url}>
                            {result.url}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="text-sm font-medium text-foreground">{result.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.opener ? (
                            <div className="max-w-xs truncate" title={result.opener}>
                              {result.opener}
                            </div>
                          ) : (
                            <span className="text-default-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.error ? (
                            <div className="max-w-xs truncate text-danger" title={result.error}>
                              {result.error}
                            </div>
                          ) : (
                            <span className="text-default-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{result.retry_count}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </main>

      {/* Retry Modal */}
      <Modal isOpen={isRetryModalOpen} onClose={onRetryModalClose}>
        <ModalContent>
          <ModalHeader>Retry Job</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to retry the job "{job.file_name}"? 
              This will reprocess all failed URLs.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="ghost" 
              onPress={onRetryModalClose}
              className="hover:bg-secondary/50 rounded-bubbly"
            >
              Cancel
            </Button>
            <Button 
              color="warning" 
              onPress={handleRetryJob}
              className="rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300"
            >
              Retry Job
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

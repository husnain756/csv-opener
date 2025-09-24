'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { useRouter } from 'next/navigation'
import { jobService } from '@/services'
import { useJobManagementSSE } from '@/hooks'

interface Job {
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

export default function JobsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen: isRetryModalOpen, onOpen: onRetryModalOpen, onClose: onRetryModalClose } = useDisclosure()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  // Get job IDs for SSE connections (memoized to prevent unnecessary re-renders)
  const jobIds = useMemo(() => jobs.map(job => job.id), [jobs])
  
  // Use SSE for real-time updates
  const { jobProgress, isConnected, error: sseError } = useJobManagementSSE(jobIds)

  useEffect(() => {
    fetchJobs()
  }, [])

  // Update jobs with real-time SSE data
  useEffect(() => {
    if (Object.keys(jobProgress).length > 0) {
      setJobs(prevJobs => 
        prevJobs.map(job => {
          const progress = jobProgress[job.id]
          if (progress) {
            return {
              ...job,
              status: progress.status,
              processed_rows: progress.progress.completed,
              failed_rows: progress.progress.failed,
              progress: `${progress.progress.completed}/${progress.progress.total}`
            }
          }
          return job
        })
      )
    }
  }, [jobProgress])

  const fetchJobs = async () => {
    try {
      const data = await jobService.getAllJobs()
      console.log('Fetched jobs data:', data) // Debug log
      setJobs(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching jobs:', err) // Debug log
      
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-default-500" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-success" />
      case 'failed': return <XCircle className="w-4 h-4 text-danger" />
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-warning" />
      default: return <Clock className="w-4 h-4 text-default-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default'
      case 'processing': return 'primary'
      case 'completed': return 'success'
      case 'failed': return 'danger'
      case 'cancelled': return 'warning'
      default: return 'default'
    }
  }

  const handleRetryJob = async (job: Job) => {
    try {
      const response = await fetch(`/api/jobs/${job.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        await fetchJobs() // Refresh the list
      }
    } catch (err) {
      setError('Failed to retry job')
    }
  }

  // Remove individual job page - no longer needed

  const handleDownloadResults = async (job: Job) => {
    try {
      const blob = await jobService.downloadResults(job.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${job.file_name}-results.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download results')
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

  return (
    <div>
      <main className="container mx-auto px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              isIconOnly
              variant="ghost"
              onPress={() => {
                const from = searchParams.get('from')
                if (from === 'preview') {
                  // Go back to preview step on main page
                  router.push('/?step=preview')
                } else {
                  // Default behavior - go to home page
                  router.push('/')
                }
              }}
              className="hover:bg-secondary/50 rounded-bubbly"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Job Management</h1>
              <p className="text-base text-foreground/70">Monitor and manage your CSV processing jobs</p>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-danger/50 card-bubbly">
            <CardBody className="p-4">
              <div className="flex items-center gap-3 text-danger">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            </CardBody>
          </Card>
        )}


        {/* Jobs Table */}
        <Card className="card-bubbly">
          <CardHeader className="card-header-shadow">
            <div className="flex items-center justify-between w-full p-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">All Jobs</h2>
                {isConnected && (
                  <Chip
                    size="sm"
                    color="success"
                    variant="flat"
                    startContent={<div className="w-2 h-2 bg-success rounded-full animate-pulse" />}
                  >
                    Live Updates
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
                {!isConnected && !sseError && jobIds.length > 0 && (
                  <Chip
                    size="sm"
                    color="default"
                    variant="flat"
                    startContent={<div className="w-2 h-2 bg-default rounded-full" />}
                  >
                    Connecting...
                  </Chip>
                )}
              </div>
              <Button
                color="primary"
                variant="bordered"
                startContent={<RefreshCw className="w-4 h-4" />}
                onPress={fetchJobs}
                aria-label="Refresh jobs list"
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-default-500">No jobs found</p>
                <p className="text-xs text-default-400 mt-2">Jobs count: {jobs.length}</p>
                <Button
                  color="primary"
                  className="mt-4"
                  onPress={() => router.push('/')}
                >
                  Create New Job
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table 
                  aria-label="Jobs table"
                  classNames={{
                    wrapper: "",
                    table: "",
                    thead: "bg-default-100 dark:bg-default-800",
                    tbody: "divide-y divide-default-100 dark:divide-default-800",
                    tr: "hover:bg-default-100 dark:hover:bg-default-700 transition-colors duration-200",
                    th: "bg-default-100 dark:bg-default-800 text-default-700 dark:text-default-100 font-semibold py-2",
                    td: "py-2 text-default-900 dark:text-default-100"
                  }}
                >
                  <TableHeader>
                    <TableColumn>FILE NAME</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>PROGRESS</TableColumn>
                    <TableColumn>LAST UPDATED</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow 
                        key={job.id}
                        className="hover:bg-default-100 dark:hover:bg-default-700 transition-colors duration-200"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{job.file_name}</span>
                            {job.status === 'completed' && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                onPress={() => handleDownloadResults(job)}
                                className="hover:bg-secondary/50 rounded-bubbly"
                                aria-label={`Download results for ${job.file_name}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            {job.status}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {job.processed_rows}/{job.total_rows} processed
                              </span>
                            </div>
                            {job.status !== 'completed' && (
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
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary-600 drop-shadow-sm">
                                    {progressPercentage(job)}%
                                  </span>
                                </div>
                              </div>
                            )}
                            {/* Debug: Job status is {job.status} */}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(job.updated_at).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              startContent={<Eye className="w-4 h-4" />}
                              onPress={() => router.push(`/jobs/${job.id}`)}
                              className="hover:bg-secondary/50 rounded-bubbly"
                              aria-label={`View details for ${job.file_name}`}
                            >
                              Details
                            </Button>
                            {job.status === 'failed' && (
                              <Button
                                size="sm"
                                color="warning"
                                variant="ghost"
                                startContent={<Play className="w-4 h-4" />}
                                onPress={() => {
                                  setSelectedJob(job)
                                  onRetryModalOpen()
                                }}
                                className="hover:bg-warning/10 rounded-bubbly"
                                aria-label={`Retry job ${job.file_name}`}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
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
              Are you sure you want to retry the job "{selectedJob?.file_name}"? 
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
              onPress={() => {
                if (selectedJob) {
                  handleRetryJob(selectedJob)
                  onRetryModalClose()
                }
              }}
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

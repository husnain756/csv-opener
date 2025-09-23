'use client'

import { useState, useEffect } from 'react'
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
  Link,
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
  Eye, 
  RefreshCw, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { jobService } from '@/services'

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
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isOpen: isRetryModalOpen, onOpen: onRetryModalOpen, onClose: onRetryModalClose } = useDisclosure()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [pollingInterval, setPollingInterval] = useState(15000) // Start with 15 seconds

  useEffect(() => {
    fetchJobs()
    
    // Intelligent polling that adapts based on rate limiting and job status
    const interval = setInterval(() => {
      // Don't poll if rate limited
      if (rateLimited) {
        console.log('Skipping poll due to rate limiting')
        return
      }
      
      fetchJobs()
    }, pollingInterval)
    
    return () => clearInterval(interval)
  }, [rateLimited, pollingInterval]) // Removed 'jobs' from dependencies

  // Separate effect to check if all jobs are completed and stop polling
  useEffect(() => {
    const allJobsCompleted = jobs.every(job => 
      ['completed', 'failed', 'cancelled'].includes(job.status)
    )
    
    if (allJobsCompleted && jobs.length > 0) {
      console.log('All jobs completed, stopping polling')
      // You could set a flag here to stop polling, but for now we'll let it continue
      // with a longer interval to catch any new jobs
    }
  }, [jobs])

  const fetchJobs = async () => {
    try {
      setRateLimited(false)
      const data = await jobService.getAllJobs()
      console.log('Fetched jobs data:', data) // Debug log
      setJobs(data)
      setError(null)
      
      // Reset polling interval on successful fetch
      if (pollingInterval > 15000) {
        setPollingInterval(15000)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err) // Debug log
      
      if (err instanceof Error && err.message.includes('Rate limited')) {
        setRateLimited(true)
        // Exponential backoff: increase polling interval
        setPollingInterval(prev => Math.min(prev * 2, 60000)) // Max 60 seconds
        setError('Rate limited - updates will resume automatically')
        
        // Auto-resume after 30 seconds
        setTimeout(() => {
          setRateLimited(false)
          setError(null)
        }, 30000)
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
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

  const handleViewDetails = (job: Job) => {
    router.push(`/jobs/${job.id}`)
  }

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
              onPress={() => router.push('/')}
              className="hover:bg-secondary/50 rounded-bubbly"
              aria-label="Go back to home page"
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

        {/* Rate Limit Warning */}
        {rateLimited && (
          <Card className="mb-8 border-warning/50 card-bubbly">
            <CardBody className="p-4">
              <div className="flex items-center gap-3 text-warning">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Rate limited - Updates will resume automatically in 30 seconds</span>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Jobs Table */}
        <Card className="card-bubbly">
          <CardHeader className="card-header-shadow">
            <div className="flex items-center justify-between w-full p-4">
              <h2 className="text-xl font-semibold">All Jobs</h2>
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
                <Table aria-label="Jobs table">
                  <TableHeader>
                    <TableColumn>FILE NAME</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>TOTAL ROWS</TableColumn>
                    <TableColumn>PROGRESS</TableColumn>
                    <TableColumn>LAST UPDATED</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
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
                          <Chip
                            color={getStatusColor(job.status)}
                            size="sm"
                            startContent={getStatusIcon(job.status)}
                          >
                            {job.status}
                          </Chip>
                        </TableCell>
                        <TableCell>{job.total_rows}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress 
                              value={progressPercentage(job)} 
                              color="primary"
                              size="sm"
                              aria-label={`Progress: ${progressPercentage(job)}%`}
                            />
                            <div className="text-xs text-default-500">
                              {job.processed_rows}/{job.total_rows} processed
                            </div>
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
                              onPress={() => handleViewDetails(job)}
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

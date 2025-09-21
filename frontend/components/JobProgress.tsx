'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  CardBody, 
  CardHeader,
  Button, 
  Progress,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@nextui-org/react'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react'

interface JobProgressProps {
  jobId: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | null
  onCancel: () => void
}

interface JobStatus {
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

export function JobProgress({ jobId, status, onCancel }: JobProgressProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [failedRows, setFailedRows] = useState<any[]>([])
  const { isOpen: isRetryModalOpen, onOpen: onRetryModalOpen, onClose: onRetryModalClose } = useDisclosure()

  useEffect(() => {
    if (!jobId || !isPolling) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        const data = await response.json()
        
        setJobStatus(data)
        
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false)
          if (data.status === 'failed') {
            setFailedRows(data.results?.filter((r: any) => r.status === 'failed') || [])
          }
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [jobId, isPolling])

  const handleRetryFailed = async () => {
    if (!jobId || failedRows.length === 0) return

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rowIds: failedRows.map(row => row.rowId) 
        })
      })

      if (response.ok) {
        setIsPolling(true)
        setFailedRows([])
        onRetryModalClose()
      }
    } catch (error) {
      console.error('Failed to retry job:', error)
    }
  }

  const handleRetrySingle = async (rowId: string) => {
    if (!jobId) return

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds: [rowId] })
      })

      if (response.ok) {
        setIsPolling(true)
      }
    } catch (error) {
      console.error('Failed to retry single row:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'processing': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default'
      case 'processing': return 'primary'
      case 'completed': return 'success'
      case 'failed': return 'danger'
      default: return 'default'
    }
  }

  const progressPercentage = jobStatus 
    ? Math.round((jobStatus.progress.completed / jobStatus.progress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <Card>
        <CardHeader className="card-header-shadow">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {getStatusIcon(status || 'pending')}
              <div>
                <h2 className="text-xl font-semibold">Processing Job</h2>
                <p className="text-sm text-default-500">
                  Job ID: {jobId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status === 'processing' && (
                <Button
                  variant="ghost"
                  color="danger"
                  onPress={onCancel}
                  aria-label="Cancel current job processing"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercentage}%</span>
            </div>
            <Progress 
              value={progressPercentage} 
              color="primary"
              className="w-full"
            />
          </div>

          {/* Stats */}
          {jobStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {jobStatus.progress.total}
                </div>
                <div className="text-sm text-default-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {jobStatus.progress.completed}
                </div>
                <div className="text-sm text-default-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {jobStatus.progress.pending}
                </div>
                <div className="text-sm text-default-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-danger">
                  {jobStatus.progress.failed}
                </div>
                <div className="text-sm text-default-500">Failed</div>
              </div>
            </div>
          )}

          {/* Cost Information */}
          {jobStatus?.cost && (
            <div className="bg-default-100 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Cost Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-default-500">Tokens Used:</span>
                  <span className="ml-2 font-medium">{jobStatus.cost.tokensUsed.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-default-500">Estimated Cost:</span>
                  <span className="ml-2 font-medium">${jobStatus.cost.estimatedCost.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {jobStatus?.error && (
            <div className="bg-danger-50 border border-danger-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-danger">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Job Error</span>
              </div>
              <p className="text-sm text-danger-600 mt-1">{jobStatus.error}</p>
            </div>
          )}

          {/* Retry Failed Button */}
          {jobStatus?.progress.failed && jobStatus.progress.failed > 0 && status !== 'processing' && (
            <div className="flex justify-center">
              <Button
                color="warning"
                variant="bordered"
                startContent={<RotateCcw className="w-4 h-4" />}
                onPress={onRetryModalOpen}
                aria-label={`Retry ${jobStatus.progress.failed} failed rows`}
              >
                Retry Failed Rows ({jobStatus.progress.failed})
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Recent Results */}
      {jobStatus?.results && jobStatus.results.length > 0 && (
        <Card>
          <CardHeader className="card-header-shadow">
            <h3 className="text-lg font-semibold">Recent Results</h3>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table aria-label="Recent results">
                <TableHeader>
                  <TableColumn>URL</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Opener</TableColumn>
                  <TableColumn>Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {jobStatus.results.slice(-10).map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={result.url}>
                          {result.url}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={result.status === 'success' ? 'success' : 'danger'}
                          size="sm"
                          startContent={result.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        >
                          {result.status}
                        </Chip>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate" title={result.opener}>
                          {result.opener || result.error || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            color="warning"
                            onPress={() => handleRetrySingle(result.rowId)}
                            aria-label={`Retry row ${result.rowId}`}
                          >
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Retry Modal */}
      <Modal isOpen={isRetryModalOpen} onClose={onRetryModalClose} size="2xl">
        <ModalContent>
          <ModalHeader>Retry Failed Rows</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              {failedRows.length} rows failed to process. Would you like to retry them?
            </p>
            <div className="max-h-60 overflow-y-auto">
              <Table aria-label="Failed rows">
                <TableHeader>
                  <TableColumn>URL</TableColumn>
                  <TableColumn>Error</TableColumn>
                </TableHeader>
                <TableBody>
                  {failedRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={row.url}>
                          {row.url}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate text-danger" title={row.error}>
                          {row.error}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={onRetryModalClose} aria-label="Cancel retry operation">
              Cancel
            </Button>
            <Button color="warning" onPress={handleRetryFailed} aria-label="Retry all failed rows">
              Retry All Failed
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}


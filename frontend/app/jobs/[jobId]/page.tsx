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
  Pagination,
  Input,
  Select,
  SelectItem,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner
} from '@nextui-org/react'
import { 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Filter,
  RotateCcw
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { jobService } from '@/services'
import { JobRetry } from './JobRetry'
import { JobDetails, UrlRecord } from '@/types'

const ITEMS_PER_PAGE = 20

export default function JobDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const [job, setJob] = useState<JobDetails | null>(null)
  const [urls, setUrls] = useState<UrlRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState(false)

  const { isOpen: isRetryModalOpen, onOpen: onRetryModalOpen, onClose: onRetryModalClose } = useDisclosure()

  useEffect(() => {
    if (jobId) {
      fetchJobDetails()
      fetchUrls()
      
      // Set up polling for real-time updates - reduced frequency to avoid 429 errors
      const interval = setInterval(() => {
        // Only poll if job is still processing and not rate limited
        if (!job || (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled')) {
          if (!rateLimited) {
            fetchJobDetails()
            fetchUrls()
          }
        } else {
          // Job is completed, stop polling
          clearInterval(interval)
        }
      }, 15000) // Increased to 15 seconds to reduce API calls
      
      return () => clearInterval(interval)
    }
  }, [jobId, job, rateLimited])

  const fetchJobDetails = async () => {
    try {
      const data = await jobService.getJobDetails(jobId)
      setJob(data)
      setRateLimited(false)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Rate limited')) {
        setRateLimited(true)
        // Auto-resume after 30 seconds
        setTimeout(() => setRateLimited(false), 30000)
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }
  }

  const fetchUrls = async () => {
    try {
      const data = await jobService.getJobResults(jobId)
      setUrls(data.urls || [])
      setRateLimited(false)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Rate limited')) {
        setRateLimited(true)
        // Auto-resume after 30 seconds
        setTimeout(() => setRateLimited(false), 30000)
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

  const filteredUrls = urls.filter(url => {
    const matchesSearch = url.url.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || url.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredUrls.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedUrls = filteredUrls.slice(startIndex, endIndex)

  const handleRetrySingle = async (urlId: string) => {
    try {
      setRetrying(true)
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlIds: [urlId] })
      })
      
      if (response.ok) {
        await fetchUrls()
      }
    } catch (err) {
      setError('Failed to retry URL')
    } finally {
      setRetrying(false)
    }
  }

  const handleBulkRetry = async () => {
    if (selectedUrls.size === 0) return

    try {
      setRetrying(true)
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlIds: Array.from(selectedUrls) })
      })
      
      if (response.ok) {
        setSelectedUrls(new Set())
        await fetchUrls()
        onRetryModalClose()
      }
    } catch (err) {
      setError('Failed to retry URLs')
    } finally {
      setRetrying(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedUrls.size === paginatedUrls.length) {
      setSelectedUrls(new Set())
    } else {
      setSelectedUrls(new Set(paginatedUrls.map(url => url.id)))
    }
  }

  const handleSelectUrl = (urlId: string) => {
    const newSelected = new Set(selectedUrls)
    if (newSelected.has(urlId)) {
      newSelected.delete(urlId)
    } else {
      newSelected.add(urlId)
    }
    setSelectedUrls(newSelected)
  }

  const statusOptions = [
    { key: 'all', label: 'All Statuses' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
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
              onPress={() => router.push('/jobs')}
              className="hover:bg-secondary/50 rounded-bubbly"
              aria-label="Go back to jobs list"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Job Details</h1>
              <p className="text-base text-foreground/70">
                {job?.fileName} • {urls.length} URLs
              </p>
            </div>
          </div>
        </div>
        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-danger/50 card-bubbly">
            <CardBody className="py-4">
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
            <CardBody className="py-4">
              <div className="flex items-center gap-3 text-warning">
                <Clock className="w-5 h-5" />
                <span className="font-medium">Rate limited - Updates will resume automatically</span>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Job Summary */}
        {job && (
          <Card className="mb-8 card-bubbly">
            <CardHeader className="card-header-shadow">
              <h2 className="text-xl font-semibold">Job Summary</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{job.totalRows}</div>
                  <div className="text-sm text-default-500">Total URLs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">{job.processedRows}</div>
                  <div className="text-sm text-default-500">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-danger">{job.failedRows}</div>
                  <div className="text-sm text-default-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-default">
                    {job.totalRows - job.processedRows - job.failedRows}
                  </div>
                  <div className="text-sm text-default-500">Pending</div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Filters and Actions */}
        <Card className="mb-8 card-bubbly">
          <CardBody>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                <Input
                  placeholder="Search URLs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  startContent={<Filter className="w-4 h-4" />}
                  className="max-w-xs"
                  aria-label="Search URLs"
                />
                <Select
                  placeholder="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="max-w-xs"
                  aria-label="Filter URLs by status"
                >
                  {statusOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  color="primary"
                  variant="bordered"
                  startContent={<RefreshCw className="w-4 h-4" />}
                  onPress={fetchUrls}
                  className="border border-divider/50 rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300"
                  aria-label="Refresh URLs"
                >
                  Refresh
                </Button>
                {selectedUrls.size > 0 && (
                  <Button
                    color="warning"
                    startContent={<RotateCcw className="w-4 h-4" />}
                    onPress={onRetryModalOpen}
                    className="rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300"
                    aria-label={`Retry ${selectedUrls.size} selected URLs`}
                  >
                    Retry Selected ({selectedUrls.size})
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* URLs Table */}
        <Card className="card-bubbly">
          <CardHeader className="card-header-shadow">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-xl font-semibold">URLs ({filteredUrls.length})</h2>
              <div className="flex items-center gap-2">
                <Checkbox
                  isSelected={selectedUrls.size === paginatedUrls.length && paginatedUrls.length > 0}
                  isIndeterminate={selectedUrls.size > 0 && selectedUrls.size < paginatedUrls.length}
                  onChange={handleSelectAll}
                  aria-label="Select all URLs on current page"
                >
                  Select All
                </Checkbox>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <Table aria-label="URLs table">
                <TableHeader>
                  <TableColumn>SELECT</TableColumn>
                  <TableColumn>URL</TableColumn>
                  <TableColumn>STATUS</TableColumn>
                  <TableColumn>OPENER</TableColumn>
                  <TableColumn>ERROR</TableColumn>
                  <TableColumn>RETRY COUNT</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody>
                  {paginatedUrls.map((url) => (
                    <TableRow key={url.id}>
                      <TableCell>
                        <Checkbox
                          isSelected={selectedUrls.has(url.id)}
                          onChange={() => handleSelectUrl(url.id)}
                          aria-label={`Select URL ${url.url}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={url.url}>
                          {url.url}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={getStatusColor(url.status)}
                          size="sm"
                          startContent={getStatusIcon(url.status)}
                        >
                          {url.status}
                        </Chip>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate" title={url.opener}>
                          {url.opener || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-danger" title={url.error}>
                          {url.error || '-'}
                        </div>
                      </TableCell>
                      <TableCell>{url.retryCount}</TableCell>
                      <TableCell>
                        {url.status === 'failed' && (
                          <Button
                            size="sm"
                            color="warning"
                            variant="ghost"
                            startContent={<Play className="w-4 h-4" />}
                            onPress={() => handleRetrySingle(url.id)}
                            isLoading={retrying}
                            className="hover:bg-warning/10 rounded-bubbly"
                            aria-label={`Retry URL ${url.url}`}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  total={totalPages}
                  page={currentPage}
                  onChange={setCurrentPage}
                  showControls
                />
              </div>
            )}
          </CardBody>
        </Card>
      </main>

      {/* Bulk Retry Modal */}
      <Modal isOpen={isRetryModalOpen} onClose={onRetryModalClose}>
        <ModalContent>
          <ModalHeader>Retry Selected URLs</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to retry {selectedUrls.size} selected URLs? 
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
              onPress={handleBulkRetry}
              isLoading={retrying}
              className="rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300"
            >
              Retry URLs
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

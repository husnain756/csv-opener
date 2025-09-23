'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Select,
  SelectItem,
  Textarea,
  Divider
} from '@nextui-org/react'
import { 
  Upload, 
  FileText,
  Play, 
  Download, 
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib'
import { jobService } from '@/services'
import { CSVUploader } from './jobs/CSVUploader'
import { CSVPreview } from './jobs/CSVPreview'
import { JobProgress } from './jobs/JobProgress'
import { CSVRow } from '@/types'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  
  const {
    currentStep,
    csvData,
    selectedColumn,
    contentType,
    jobId,
    jobStatus,
    results,
    error,
    setCurrentStep,
    setCsvData,
    setSelectedColumn,
    setContentType,
    setJobId,
    setJobStatus,
    setResults,
    setError,
    resetApp
  } = useAppStore()

  const [fileName, setFileName] = useState<string>('')

  const handleCSVUpload = (data: CSVRow[], fileName: string) => {
    setCsvData(data)
    setFileName(fileName)
    setCurrentStep('preview')
  }

  const handleStartProcessing = async () => {
    console.log('Start processing clicked!', { csvData: csvData?.length, selectedColumn, contentType })
    
    if (!csvData || !contentType) {
      console.log('Missing required data:', { csvData: !!csvData, contentType })
      setError('Please select a content type and ensure CSV data is loaded')
      return
    }
    
    try {
      setError(null)
      setCurrentStep('processing')
      
      // Step 1: Upload CSV file
      const csvContent = generateCSVContent(csvData)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const file = new File([blob], 'uploaded.csv', { type: 'text/csv' })
      
      console.log('Uploading CSV file...')
      const uploadResponse = await jobService.uploadAndProcessCSV(file, contentType)
      
      console.log('Upload successful:', uploadResponse)
      
      setJobId(uploadResponse.jobId)
      setJobStatus('processing')
      
      // Redirect to job management page to see the job in the listing
      router.push('/jobs')
      
    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setCurrentStep('preview')
    }
  }

  // Helper function to generate CSV content from data
  const generateCSVContent = (data: any[]) => {
    if (!data || data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
    ]
    
    return csvRows.join('\n')
  }

  const pollJobStatus = async (id: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job status: ${response.statusText}`)
        }
        
        const data = await response.json()
        console.log('Job status update:', data)
        
        setJobStatus(data.status)
        
        if (data.status === 'completed') {
          // Fetch results when job is completed
          const resultsResponse = await fetch(`/api/jobs/${id}/results`)
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json()
            setResults(resultsData.urls.map((url: any) => ({
              rowId: url.url, // Using URL as rowId for now
              url: url.url,
              opener: url.opener || '',
              status: url.status === 'completed' ? 'success' : 'failed',
              error: url.error || ''
            })))
          }
          setCurrentStep('results')
        } else if (data.status === 'failed') {
          setError(data.error || 'Job failed')
          setCurrentStep('preview')
        } else if (data.status === 'processing' || data.status === 'pending') {
          // Continue polling
          setTimeout(poll, 2000)
        }
      } catch (err) {
        console.error('Polling error:', err)
        setError('Failed to check job status')
        setCurrentStep('preview')
      }
    }
    
    poll()
  }

  const handleDownloadResults = async () => {
    if (!jobId) return
    
    try {
      const response = await fetch(`/api/upload/${jobId}/download`)
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `opener-results-${jobId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
      setError('Failed to download results')
    }
  }

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'upload': return <Upload className="w-5 h-5" />
      case 'preview': return <FileText className="w-5 h-5" />
      case 'processing': return <Play className="w-5 h-5" />
      case 'results': return <Download className="w-5 h-5" />
      default: return <Upload className="w-5 h-5" />
    }
  }

  const getStepColor = (step: string) => {
    const currentStepIndex = ['upload', 'preview', 'processing', 'results'].indexOf(currentStep)
    const stepIndex = ['upload', 'preview', 'processing', 'results'].indexOf(step)
    
    if (stepIndex < currentStepIndex) return 'success'
    if (stepIndex === currentStepIndex) return 'primary'
    return 'default'
  }

  return (
    <div>
      {/* Main Content */}
      <main className="container mx-auto px-8 py-8">
        {/* Progress Steps */}
        <Card className="mb-8 card-bubbly">
          <CardBody className="py-4 px-8">
            <div className="flex items-center justify-between">
              {['upload', 'preview', 'processing', 'results'].map((step, index) => (
                <div key={step} className="flex items-center xxx">
                  <Chip
                    startContent={getStepIcon(step)}
                    color={getStepColor(step)}
                    variant={currentStep === step ? 'solid' : 'flat'}
                    className="capitalize font-medium rounded-bubbly"
                    size="lg"
                  >
                    {step}
                  </Chip>
                  {index < 3 && (
                    <div className="w-12 h-0.5 bg-divider/50 mx-4" />
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

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

        {/* Step Content */}
        {currentStep === 'upload' && (
          <CSVUploader 
            onUpload={handleCSVUpload}
          />
        )}

        {currentStep === 'preview' && csvData && (
          <CSVPreview
            data={csvData}
            selectedColumn={null}
            contentType={contentType}
            onColumnSelect={() => {}}
            onContentTypeSelect={setContentType}
            onStartProcessing={handleStartProcessing}
            onBack={() => setCurrentStep('upload')}
          />
        )}

        {currentStep === 'processing' && (
          <JobProgress 
            jobId={jobId}
            status={jobStatus}
            onCancel={() => {
              setCurrentStep('preview')
              setJobId(null)
            }}
          />
        )}

        {currentStep === 'results' && results && (
          <Card>
            <CardHeader className="card-header-shadow">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-semibold">Processing Complete</h2>
                <Button
                  color="primary"
                  startContent={<Download className="w-4 h-4" />}
                  onPress={handleDownloadResults}
                  aria-label="Download processing results as CSV"
                >
                  Download Results
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Chip color="success" startContent={<CheckCircle className="w-4 h-4" />}>
                    {results.filter((r: any) => r.status === 'success').length} Successful
                  </Chip>
                  <Chip color="danger" startContent={<XCircle className="w-4 h-4" />}>
                    {results.filter((r: any) => r.status === 'failed').length} Failed
                  </Chip>
                </div>
                
                <Divider />
                
                <Table aria-label="Results table">
                  <TableHeader>
                    <TableColumn>URL</TableColumn>
                    <TableColumn>Generated Opener</TableColumn>
                    <TableColumn>Status</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {results.slice(0, 10).map((result: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-xs truncate">
                          {result.url}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {result.opener || 'Failed to generate'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            color={result.status === 'success' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {result.status}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {results.length > 10 && (
                  <p className="text-small text-default-500 text-center">
                    Showing first 10 results. Download CSV for complete results.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* New Job Button */}
        {currentStep === 'results' && (
          <div className="mt-6 text-center">
            <Button
              color="primary"
              variant="bordered"
              onPress={() => {
                resetApp()
                setCurrentStep('upload')
              }}
              aria-label="Start processing another CSV file"
            >
              Process Another CSV
            </Button>
          </div>
        )}
      </main>

    </div>
  )
}
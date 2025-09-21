'use client'

import { useState } from 'react'
import { 
  Card, 
  CardBody, 
  CardHeader,
  Button,
  Progress,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
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
  Settings, 
  Moon, 
  Sun,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib/store/appStore'
import { CSVUploader } from '@/components/CSVUploader'
import { CSVPreview } from '@/components/CSVPreview'
import { JobProgress } from '@/components/JobProgress'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SettingsModal } from '@/components/SettingsModal'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()
  
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

  const handleStartProcessing = async () => {
    console.log('Start processing clicked!', { csvData: csvData?.length, selectedColumn, contentType })
    
    if (!csvData || !selectedColumn) {
      console.log('Missing required data:', { csvData: !!csvData, selectedColumn })
      return
    }
    
    try {
      setError(null)
      setCurrentStep('processing')
      setJobId('demo-job-123')
      setJobStatus('processing')
      
      // Simulate processing for demo
      setTimeout(() => {
        setJobStatus('completed')
        setResults([
          { rowId: '1', url: 'https://example.com', opener: 'Generated opener text', status: 'success' },
          { rowId: '2', url: 'https://test.com', opener: 'Another generated opener', status: 'success' }
        ])
        setCurrentStep('results')
      }, 3000)
      
    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setCurrentStep('preview')
    }
  }

  const pollJobStatus = async (id: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`)
        const data = await response.json()
        
        setJobStatus(data.status)
        
        if (data.status === 'completed') {
          setResults(data.results)
          setCurrentStep('results')
        } else if (data.status === 'failed') {
          setError(data.error || 'Job failed')
          setCurrentStep('preview')
        } else {
          // Continue polling
          setTimeout(poll, 2000)
        }
      } catch (err) {
        setError('Failed to check job status')
        setCurrentStep('preview')
      }
    }
    
    poll()
  }

  const handleDownloadResults = () => {
    if (!results) return
    
    const csvContent = [
      ['Row ID', 'Original URL', 'Generated Opener', 'Status', 'Error'],
      ...results.map((result: any) => [
        result.rowId,
        result.url,
        result.opener || '',
        result.status,
        result.error || ''
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opener-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-divider/50 bg-background/95 backdrop-blur-md shadow-bubbly sticky top-0 z-50 glow-primary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-bubbly flex items-center justify-center shadow-bubbly">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">CSV Opener</h1>
              <p className="text-base text-foreground/70 font-medium mt-1">AI-powered CSV processing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              isIconOnly
              variant="ghost"
              onPress={onSettingsOpen}
              className="hover:bg-secondary/50 rounded-bubbly w-10 h-10"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

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
            onUpload={(data) => {
              setCsvData(data)
              setCurrentStep('preview')
            }}
          />
        )}

        {currentStep === 'preview' && csvData && (
          <CSVPreview
            data={csvData}
            selectedColumn={selectedColumn}
            contentType={contentType}
            onColumnSelect={setSelectedColumn}
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

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={onSettingsClose}
      />
    </div>
  )
}
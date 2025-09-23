'use client'

import React, { useState, useCallback } from 'react'
import { 
  Card, 
  CardBody, 
  Button, 
  Progress,
  Chip
} from '@nextui-org/react'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { CSVRow } from '@/types'

// Detect CSV delimiter by analyzing the content
function detectDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5) // Check first 5 lines
  const delimiters = [',', ';', '\t', '|']
  
  let bestDelimiter = ','
  let maxCount = 0
  
  for (const delimiter of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length)
    const avgCount = counts.reduce((sum, count) => sum + count, 0) / counts.length
    
    if (avgCount > maxCount) {
      maxCount = avgCount
      bestDelimiter = delimiter
    }
  }
  
  return bestDelimiter
}

// Validate if a string is a valid URL
function isValidUrl(url: string): boolean {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    new URL(url)
    return true
  } catch {
    return false
  }
}

interface CSVUploaderProps {
  onUpload: (data: CSVRow[], fileName: string) => void
}

export function CSVUploader({ onUpload }: CSVUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const text = await file.text()
      
      // Detect delimiter
      const delimiter = detectDelimiter(text)
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`)
            setIsUploading(false)
            return
          }

          if (results.data.length === 0) {
            setError('CSV file is empty or has no valid data')
            setIsUploading(false)
            return
          }

          // Validate that we have URL-like columns
          const headers = Object.keys(results.data[0] as CSVRow)
          
          // First, check for columns with URL-related names
          let urlColumns = headers.filter(header => 
            header.toLowerCase().includes('url') || 
            header.toLowerCase().includes('link') ||
            header.toLowerCase().includes('website') ||
            header.toLowerCase().includes('domain')
          )

          // If no URL-named columns found, check all columns for URL content
          if (urlColumns.length === 0) {
            urlColumns = headers.filter(header => {
              // Check if this column contains URLs in the data
              const columnData = results.data.slice(0, 5).map((row: any) => row[header]).filter(Boolean)
              return columnData.some((value: string) => isValidUrl(value))
            })
          }

          if (urlColumns.length === 0) {
            setError('No URL columns found. Please ensure your CSV has columns containing URLs or column names with "url", "link", "website", or "domain".')
            setIsUploading(false)
            return
          }

          setUploadProgress(100)
          setTimeout(() => {
            onUpload(results.data as CSVRow[], file.name)
            setIsUploading(false)
          }, 500)
        },
        error: (error: any) => {
          setError(`Failed to parse CSV: ${error.message}`)
          setIsUploading(false)
        }
      })
    } catch (err) {
      setError('Failed to read file')
      setIsUploading(false)
    }
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  return (
    <Card className="w-full max-w-2xl mx-auto card-bubbly">
      <CardBody className="p-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 rounded-bubbly flex items-center justify-center shadow-bubbly">
              <FileText className="w-10 h-10 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          
          <div>
            <h2 className="text-3xl font-bold mb-3 text-foreground">Upload CSV File</h2>
            <p className="text-foreground/70 text-lg">
              Upload a CSV file containing URLs to generate professional outreach openers
            </p>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-bubbly p-8 transition-all duration-300 flex justify-center ${
              isDragOver 
                ? 'border-primary bg-primary/5 shadow-bubbly dark:shadow-bubbly-dark' 
                : 'border-divider/50 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            aria-label="CSV file upload area. Drop your CSV file here or click to browse."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('file-input')?.click();
              }
            }}
          >
            {isUploading ? (
              <div className="space-y-4 text-center">
                <Progress 
                  value={uploadProgress} 
                  className="max-w-md mx-auto"
                  color="primary"
                  aria-label={`Upload progress: ${uploadProgress}%`}
                />
                <p className="text-sm text-default-500">Processing CSV...</p>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <Upload className="w-12 h-12 text-default-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">Drop your CSV file here</p>
                  <p className="text-sm text-default-500">or click to browse</p>
                </div>
                <Button
                  color="primary"
                  variant="bordered"
                  onPress={() => document.getElementById('file-input')?.click()}
                  className="border border-divider/50 rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300 w-full lg:w-auto lg:min-w-[200px]"
                  aria-label="Choose CSV file to upload"
                >
                  Choose File
                </Button>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  aria-label="CSV file input"
                />
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 text-danger bg-danger/10 p-4 rounded-bubbly border border-danger/20">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Requirements */}
          <div className="text-left space-y-2">
            <h3 className="font-semibold">Requirements:</h3>
            <div className="space-y-1 text-sm text-default-600">
              <div className="flex items-center gap-2">
                <Chip size="sm" color="success" variant="flat">✓</Chip>
                <span>CSV format with headers</span>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color="success" variant="flat">✓</Chip>
                <span>At least one column containing URLs</span>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color="success" variant="flat">✓</Chip>
                <span>Maximum file size: 10MB</span>
              </div>
              <div className="flex items-center gap-2">
                <Chip size="sm" color="success" variant="flat">✓</Chip>
                <span>UTF-8 encoding recommended</span>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

'use client'

import React, { useState, useMemo } from 'react'
import { 
  Card, 
  CardBody, 
  CardHeader,
  Button, 
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell
} from '@nextui-org/react'
import { ArrowLeft, Play, Eye, EyeOff } from 'lucide-react'
import { CSVRow, ContentType } from '@/types'

interface CSVPreviewProps {
  data: CSVRow[]
  selectedColumn: string | null
  contentType: ContentType
  onColumnSelect: (column: string) => void
  onContentTypeSelect: (type: ContentType) => void
  onStartProcessing: () => void
  onBack: () => void
}

const contentTypeOptions = [
  { key: 'company', label: 'Company', description: 'Business websites and company pages' },
  { key: 'linkedin', label: 'LinkedIn/Person', description: 'LinkedIn profiles and personal pages' },
  { key: 'news', label: 'News/Community', description: 'News articles and community content' }
]

export function CSVPreview({ 
  data, 
  selectedColumn, 
  contentType, 
  onColumnSelect, 
  onContentTypeSelect, 
  onStartProcessing, 
  onBack 
}: CSVPreviewProps) {
  const [showAllRows, setShowAllRows] = useState(false)

  const columns = useMemo(() => {
    if (!data || data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  const displayData = useMemo(() => {
    return showAllRows ? data : data.slice(0, 10)
  }, [data, showAllRows])

  const handleContentTypeChange = (value: string) => {
    onContentTypeSelect(value as ContentType)
  }

  const canStartProcessing = Boolean(contentType) && data.length > 0
  
  const handleStartProcessingClick = () => {
    console.log('Start Processing button clicked!', { 
      canStartProcessing, 
      contentType, 
      dataLength: data.length,
      onStartProcessing: typeof onStartProcessing 
    })
    if (canStartProcessing) {
      onStartProcessing()
    } else {
      console.log('Button is disabled, cannot start processing')
    }
  }
  
  console.log('CSVPreview Debug:', { 
    contentType, 
    dataLength: data.length, 
    canStartProcessing,
    onStartProcessing: typeof onStartProcessing,
    selectedColumn 
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="card-bubbly">
        {/* Header Section */}
        <div className="px-4 sm:px-6 py-4 border-b border-divider/30 card-header-shadow">
          <div className="flex items-center gap-4">
            <Button
              isIconOnly
              variant="ghost"
              onPress={onBack}
              className="hover:bg-secondary/50 rounded-lg flex-shrink-0"
              aria-label="Go back to upload step"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Preview & Configure</h2>
              <p className="text-sm sm:text-base text-foreground/70 font-medium">
                {data.length} rows found • Select content type to start processing
              </p>
            </div>
          </div>
        </div>

        {/* Content Type Selection and Processing Button Section */}
        <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-divider/30">
          <div className="max-w-4xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">Configuration</h3>
            
            {/* Responsive layout: stacked on mobile, side-by-side on larger screens */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-end">
              {/* Content Type Dropdown */}
              <div className="flex-1 w-full lg:w-auto min-w-0">
                <label htmlFor="content-type-select" className="block text-sm font-medium text-foreground/70 mb-2">
                  Content Type
                </label>
                <div className="relative">
                  <select
                    id="content-type-select"
                    value={contentType}
                    onChange={(e) => handleContentTypeChange(e.target.value)}
                    className="w-full px-4 py-3 bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer"
                    aria-label="Select content type for processing"
                  >
                    <option value="">
                      Choose the type of content
                    </option>
                    {contentTypeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                  {/* Custom dropdown arrow */}
                  <div className="absolute top-[18px] right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Start Processing Button */}
              {contentType && (
                <div className="w-full lg:w-auto lg:flex-shrink-0">
                  <Button
                    color="primary"
                    size="lg"
                    startContent={<Play className="w-5 h-5" />}
                    onPress={handleStartProcessingClick}
                    isDisabled={!canStartProcessing}
                    className="border border-divider/50 rounded-bubbly font-medium shadow-bubbly hover:shadow-bubbly-lg dark:shadow-bubbly-dark dark:hover:shadow-bubbly-lg-dark transition-all duration-300 w-full lg:w-auto lg:min-w-[200px]"
                    aria-label="Start processing CSV with OpenAI"
                  >
                    Start Processing
                  </Button>
                </div>
              )}
              </div>
          </div>
        </div>
      </Card>


      {/* Data Preview */}
      <Card className="card-bubbly">
        {/* Header Section */}
        <div className="px-4 sm:px-6 py-4 border-b border-divider/30 card-header-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Data Preview</h3>
            <Button
              color="primary"
              variant="ghost"
              size="sm"
              startContent={showAllRows ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              onPress={() => setShowAllRows(!showAllRows)}
              className="rounded-lg font-medium w-full sm:w-auto"
              aria-label={showAllRows ? 'Show fewer rows' : 'Show all rows'}
            >
              {showAllRows ? 'Show Less' : 'Show All'}
            </Button>
          </div>
        </div>
        {/* Main Content Section */}
        <div className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="CSV data preview table">
              <TableHeader>
                {[
                  <TableColumn key="index">#</TableColumn>,
                  ...columns.map((column) => (
                    <TableColumn key={column}>{column}</TableColumn>
                  ))
                ]}
              </TableHeader>
              <TableBody>
                {displayData.map((row, index) => (
                  <TableRow key={index}>
                    {[
                      <TableCell key="index">
                        <span className="font-medium">{index + 1}</span>
                      </TableCell>,
                      ...columns.map((column) => (
                        <TableCell key={column}>
                          <div className="max-w-xs sm:max-w-md lg:max-w-lg truncate" title={row[column] as string}>
                            {(row[column] as string) || '-'}
                          </div>
                        </TableCell>
                      ))
                    ]}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {data.length > 10 && !showAllRows && (
            <div className="px-4 sm:px-6 py-4 text-center border-t border-divider/30 card-footer-bg">
              <Chip variant="flat" size="sm" className="text-xs sm:text-sm">
                Showing {displayData.length} of {data.length} rows
              </Chip>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

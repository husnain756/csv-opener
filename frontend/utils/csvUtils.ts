import Papa from 'papaparse'

export interface CSVParseResult {
  data: Record<string, string>[]
  errors: Papa.ParseError[]
  meta: Papa.ParseMeta
}

export interface CSVValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  urlColumns: string[]
  rowCount: number
}

/**
 * Detect CSV delimiter by analyzing the content
 */
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

/**
 * Parse CSV content with error handling
 */
export function parseCSV(content: string): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    const delimiter = detectDelimiter(content)
    
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        resolve({
          data: results.data as Record<string, string>[],
          errors: results.errors,
          meta: results.meta
        })
      }
    })
  })
}

/**
 * Validate CSV data for URL processing
 */
export function validateCSVData(data: Record<string, string>[]): CSVValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (data.length === 0) {
    errors.push('CSV file is empty or has no valid data')
    return { isValid: false, errors, warnings, urlColumns: [], rowCount: 0 }
  }

  const headers = Object.keys(data[0])
  const urlColumns = headers.filter(header => 
    header.toLowerCase().includes('url') || 
    header.toLowerCase().includes('link') ||
    header.toLowerCase().includes('website') ||
    header.toLowerCase().includes('domain')
  )

  if (urlColumns.length === 0) {
    errors.push('No URL columns found. Please ensure your CSV has columns containing URLs.')
  }

  // Check for empty rows
  const emptyRows = data.filter(row => 
    Object.values(row).every(value => !value || value.trim() === '')
  )
  
  if (emptyRows.length > 0) {
    warnings.push(`${emptyRows.length} empty rows found and will be skipped`)
  }

  // Check for rows without URLs in selected columns
  if (urlColumns.length > 0) {
    const rowsWithoutUrls = data.filter(row => 
      urlColumns.every(col => !row[col] || !isValidUrl(row[col]))
    )
    
    if (rowsWithoutUrls.length > 0) {
      warnings.push(`${rowsWithoutUrls.length} rows don't contain valid URLs`)
    }
  }

  // Check file size limits
  if (data.length > 50000) {
    errors.push('File contains more than 50,000 rows. Please split into smaller files.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    urlColumns,
    rowCount: data.length
  }
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
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

/**
 * Normalize URL by adding protocol if missing
 */
export function normalizeUrl(url: string): string {
  if (!url) return url
  
  url = url.trim()
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url
  }
  
  return url
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const normalizedUrl = normalizeUrl(url)
    const urlObj = new URL(normalizedUrl)
    return urlObj.hostname
  } catch {
    return url
  }
}

/**
 * Generate CSV content from data
 */
export function generateCSV(data: Record<string, any>[], headers?: string[]): string {
  if (data.length === 0) return ''
  
  const csvHeaders = headers || Object.keys(data[0])
  const csvRows = data.map(row => 
    csvHeaders.map(header => {
      const value = row[header] || ''
      // Escape CSV values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
  )
  
  return [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n')
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string = 'export.csv'): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Estimate processing time based on row count and concurrency
 */
export function estimateProcessingTime(rowCount: number, concurrency: number = 10): number {
  // Assume 2-6 seconds per request
  const avgTimePerRequest = 4 // seconds
  const totalTime = (rowCount / concurrency) * avgTimePerRequest
  return Math.ceil(totalTime)
}

/**
 * Format time duration in human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
}

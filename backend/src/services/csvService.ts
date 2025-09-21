import csv from 'csv-parser';
import * as createCsvWriter from 'csv-writer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CSVRow, ProcessedCSVRow } from '../types';
import { validateAndNormalizeUrl } from '../utils/urlValidator';

export class CSVService {
  private uploadDir: string;
  private outputDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.outputDir = process.env.OUTPUT_DIR || './outputs';
    
    // Ensure directories exist
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private detectDelimiter(content: string): string {
    const lines = content.split('\n').slice(0, 5); // Check first 5 lines
    const delimiters = [',', ';', '\t', '|'];
    
    let bestDelimiter = ',';
    let maxCount = 0;
    
    for (const delimiter of delimiters) {
      const counts = lines.map(line => (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
      const avgCount = counts.reduce((sum, count) => sum + count, 0) / counts.length;
      
      if (avgCount > maxCount) {
        maxCount = avgCount;
        bestDelimiter = delimiter;
      }
    }
    
    return bestDelimiter;
  }

  async parseCSV(filePath: string): Promise<{ rows: CSVRow[]; columns: string[] }> {
    return new Promise((resolve, reject) => {
      const rows: CSVRow[] = [];
      let columns: string[] = [];
      let rowIndex = 0;

      // Read first few lines to detect delimiter
      const content = fs.readFileSync(filePath, 'utf8');
      const delimiter = this.detectDelimiter(content);

      fs.createReadStream(filePath)
        .pipe(csv({ separator: delimiter }))
        .on('headers', (headers: string[]) => {
          columns = headers;
        })
        .on('data', (data: Record<string, string>) => {
          const rowId = uuidv4();
          rows.push({
            id: rowId,
            originalData: data,
            url: '', // Will be set when URL column is selected
            status: 'pending',
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          rowIndex++;
        })
        .on('end', () => {
          resolve({ rows, columns });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async validateAndSetUrls(rows: CSVRow[], urlColumn: string): Promise<{ validRows: CSVRow[]; invalidRows: CSVRow[] }> {
    const validRows: CSVRow[] = [];
    const invalidRows: CSVRow[] = [];

    for (const row of rows) {
      const urlValue = row.originalData[urlColumn];
      const validation = validateAndNormalizeUrl(urlValue);

      if (validation.isValid && validation.normalizedUrl) {
        row.url = validation.normalizedUrl;
        validRows.push(row);
      } else {
        row.status = 'failed';
        row.error = validation.error || 'Invalid URL';
        invalidRows.push(row);
      }
    }

    return { validRows, invalidRows };
  }

  async exportProcessedCSV(
    jobId: string, 
    rows: CSVRow[]
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `${jobId}_results.csv`);
    
    const processedRows: ProcessedCSVRow[] = rows.map(row => ({
      original_row_id: row.id,
      original_url: row.url,
      opener_text: row.opener || '',
      status: row.status,
      error_message: row.error
    }));

    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'original_row_id', title: 'Original Row ID' },
        { id: 'original_url', title: 'Original URL' },
        { id: 'opener_text', title: 'Opener Text' },
        { id: 'status', title: 'Status' },
        { id: 'error_message', title: 'Error Message' }
      ]
    });

    await csvWriter.writeRecords(processedRows);
    return outputPath;
  }

  getPreview(rows: CSVRow[], limit: number = 10): CSVRow[] {
    return rows.slice(0, limit);
  }

  async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up file:', error);
    }
  }

  async cleanupJobFiles(jobId: string): Promise<void> {
    const uploadPath = path.join(this.uploadDir, `${jobId}.csv`);
    const outputPath = path.join(this.outputDir, `${jobId}_results.csv`);
    
    await Promise.all([
      this.cleanupFile(uploadPath),
      this.cleanupFile(outputPath)
    ]);
  }
}


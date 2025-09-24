import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../services/database';
import { CSVService } from '../services/csvService';
import { addChunkedJobs } from '../services/queue';
import { progressEmitter } from '../services/progressEmitter';
import { ContentType } from '../types';
import { logger } from '../utils/logger';

export class UploadController {
  private csvService: CSVService;
  private upload: multer.Multer;

  constructor() {
    this.csvService = new CSVService();

    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const jobId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${jobId}${ext}`);
      },
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are allowed'));
        }
      },
    });
  }

  getUploadMiddleware() {
    return this.upload.single('csvFile');
  }

  private detectUrlColumn(columns: string[], rows: any[]): string | null {
    logger.info(`Detecting URL column from ${columns.length} columns: ${columns.join(', ')}`);
    
    // First, check for columns with URL-related names
    let urlColumn = columns.find(column => 
      column.toLowerCase().includes('url') || 
      column.toLowerCase().includes('link') ||
      column.toLowerCase().includes('website') ||
      column.toLowerCase().includes('domain')
    );

    if (urlColumn) {
      logger.info(`Found URL-named column: ${urlColumn}`);
      return urlColumn;
    }

    // If no URL-named columns found, check all columns for URL content
    for (const column of columns) {
      const sampleValues = rows.slice(0, 5).map(row => row.originalData[column]).filter(Boolean);
      logger.info(`Checking column '${column}' with sample values:`, sampleValues);
      
      const hasUrls = sampleValues.some(value => {
        const isValid = this.isValidUrl(value);
        logger.info(`Value '${value}' is valid URL: ${isValid}`);
        return isValid;
      });
      
      if (hasUrls) {
        logger.info(`Found URL content in column: ${column}`);
        return column;
      }
    }

    logger.info('No URL column found');
    return null;
  }

  private isValidUrl(url: string): boolean {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async uploadCSV(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV file uploaded' });
        return;
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;

      // Parse CSV to get preview and columns
      const { rows, columns } = await this.csvService.parseCSV(filePath);
      const preview = this.csvService.getPreview(rows, 10);

      // Create job in database
      const jobId = await database.createJob(fileName, filePath, rows.length);

      // Auto-detect URL column
      const urlColumn = this.detectUrlColumn(columns, rows);
      logger.info(`Detected URL column: ${urlColumn}`, { columns, sampleRows: rows.slice(0, 3) });
      
      if (!urlColumn) {
        res.status(400).json({ 
          error: 'No URL column found. Please ensure your CSV has a column containing URLs.' 
        });
        return;
      }

      // Extract URLs from the detected column
      const urls = rows.map(row => (row as any).originalData[urlColumn] as string).filter(Boolean);
      logger.info(`Extracted ${urls.length} URLs from column '${urlColumn}'`, { sampleUrls: urls.slice(0, 3) });
      
      // Create URL records in database
      await database.createUrls(jobId, urls);

      logger.info(`Created job ${jobId} with ${rows.length} rows`);

      res.json({
        jobId,
        fileName,
        totalRows: rows.length,
        preview,
        columns,
      });
    } catch (error) {
      logger.error('Upload error:', error);
      res.status(500).json({
        error: 'Failed to process CSV file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async startProcessing(req: Request, res: Response): Promise<void> {
    try {
      const { jobId, contentType } = req.body;

      if (!jobId || !contentType) {
        res.status(400).json({
          error: 'Missing required fields: jobId, contentType',
        });
        return;
      }

      if (!['company', 'person', 'news'].includes(contentType)) {
        res.status(400).json({
          error: 'Invalid contentType. Must be one of: company, person, news',
        });
        return;
      }

      // Check if job exists
      const job = await database.getJob(jobId);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Get URLs for this job
      const urls = await database.getUrlsByJob(jobId);
      const urlRecords = urls.map(url => ({
        id: url.id,
        url: url.url
      }));

      // Update job status to processing and reset counters
      await database.updateJobStatus(jobId, 'processing', 0, 0);

      // Reset all URL statuses to pending for this job
      for (const urlRecord of urlRecords) {
        await database.updateUrlStatus(urlRecord.id, 'pending', undefined, undefined, 0);
      }

      // Emit job start event
      progressEmitter.emitJobStart(jobId, urlRecords.length);

      // Add chunked jobs to the queue
      await addChunkedJobs(jobId, urlRecords, contentType as ContentType);

      logger.info(`Started processing job ${jobId} with ${urlRecords.length} URLs`);

      res.json({
        jobId,
        message: 'Processing started',
      });
    } catch (error) {
      logger.error('Start processing error:', error);
      res.status(500).json({
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await database.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const progress = await database.getJobProgress(jobId);

      res.json({
        jobId: job.id,
        status: job.status,
        progress,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        fileName: job.file_name,
        totalRows: job.total_rows,
        processedRows: job.processed_rows,
        failedRows: job.failed_rows,
      });
    } catch (error) {
      logger.error('Get job status error:', error);
      res.status(500).json({
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async downloadResults(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await database.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (job.status !== 'completed') {
        res.status(400).json({ error: 'Job is not completed yet' });
        return;
      }

      // Get results from database
      const results = await database.getJobResults(jobId);
      
      // Generate CSV content
      const csvContent = this.generateResultsCSV(results.urls);
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${job.file_name}_results.csv"`);
      res.send(csvContent);
    } catch (error) {
      logger.error('Download results error:', error);
      res.status(500).json({
        error: 'Failed to download results',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private generateResultsCSV(urls: Array<{ url: string; status: string; opener?: string; error?: string }>): string {
    const headers = ['URL', 'Status', 'Opener', 'Error'];
    const rows = urls.map(url => [
      url.url,
      url.status,
      url.opener || '',
      url.error || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }

  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await database.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Update job status to canceled
      await database.updateJobStatus(jobId, 'canceled');

      logger.info(`Job ${jobId} cancelled successfully`);

      res.json({ message: 'Job cancelled successfully' });
    } catch (error) {
      logger.error('Cancel job error:', error);
      res.status(500).json({
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async retryFailedUrls(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await database.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Retry failed URLs
      const retriedCount = await database.retryFailedUrls(jobId);

      logger.info(`Retried ${retriedCount} failed URLs for job ${jobId}`);

      res.json({ 
        message: 'Failed URLs retried successfully',
        retried: retriedCount,
        jobId 
      });
    } catch (error) {
      logger.error('Retry failed URLs error:', error);
      res.status(500).json({
        error: 'Failed to retry failed URLs',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}


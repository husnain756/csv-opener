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
import { config } from '../config';
import { memoryMonitor } from '../utils/memoryMonitor';

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

      // Check file size and estimate rows
      const fileStats = require('fs').statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      // Rough estimate: 1KB per row (very conservative)
      const estimatedRows = Math.round(fileStats.size / 1024);
      
      logger.info(`Processing file: ${fileName}, Size: ${fileSizeMB.toFixed(2)}MB, Estimated rows: ${estimatedRows}`);

      // Check if we can process this file
      const memoryCheck = memoryMonitor.canProcessFile(estimatedRows);
      if (!memoryCheck.canProcess) {
        res.status(413).json({ 
          error: 'File too large to process',
          details: memoryCheck.reason
        });
        return;
      }

      // For small files, use the original method for preview
      if (estimatedRows < config.streamingBatchSize) {
        return this.uploadCSVSmall(req, res);
      }

      // For large files, use streaming method
      return this.uploadCSVStreaming(req, res);
    } catch (error) {
      logger.error('Upload error:', error);
      res.status(500).json({
        error: 'Failed to process CSV file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async uploadCSVSmall(req: Request, res: Response): Promise<void> {
    const filePath = req.file!.path;
    const fileName = req.file!.originalname;

    // Parse CSV to get preview and columns
    const { rows, columns } = await this.csvService.parseCSV(filePath);
    const preview = this.csvService.getPreview(rows, 10);

    // Create job in database
    const jobId = await database.createJob(fileName, filePath, rows.length, 'company');

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
  }

  private async uploadCSVStreaming(req: Request, res: Response): Promise<void> {
    const filePath = req.file!.path;
    const fileName = req.file!.originalname;

    // Create job in database first
    const jobId = await database.createJob(fileName, filePath, 0, 'company'); // Will update row count later

    try {
      // Get a small sample for preview and column detection
      const { rows: sampleRows, columns } = await this.csvService.parseCSV(filePath);
      const preview = this.csvService.getPreview(sampleRows, 10);

      // Auto-detect URL column from sample
      const urlColumn = this.detectUrlColumn(columns, sampleRows);
      logger.info(`Detected URL column: ${urlColumn}`, { columns, sampleRows: sampleRows.slice(0, 3) });
      
      if (!urlColumn) {
        res.status(400).json({ 
          error: 'No URL column found. Please ensure your CSV has a column containing URLs.' 
        });
        return;
      }

      // Start streaming processing in background
      this.processCSVStreaming(jobId, filePath, urlColumn, columns);

      // Return immediately with preview
      res.json({
        jobId,
        fileName,
        totalRows: 0, // Will be updated by streaming process
        preview,
        columns,
        processing: true,
        message: 'Large file detected. Processing in background...'
      });

    } catch (error) {
      logger.error(`Error in streaming upload for job ${jobId}:`, error);
      // Clean up job if there was an error
      await database.updateJobStatus(jobId, 'failed');
      throw error;
    }
  }

  private async processCSVStreaming(jobId: string, filePath: string, urlColumn: string, columns: string[]): Promise<void> {
    try {
      logger.info(`Starting background streaming processing for job ${jobId}`);
      
      const { totalRows } = await this.csvService.parseCSVStreaming(
        filePath, 
        urlColumn, 
        jobId,
        (processed, total) => {
          logger.debug(`Streaming progress for job ${jobId}: ${processed}/${total}`);
        }
      );

      // Update job with actual row count
      await database.updateJobStatus(jobId, 'pending', totalRows, 0);
      
      logger.info(`Completed streaming processing for job ${jobId}: ${totalRows} rows`);
    } catch (error) {
      logger.error(`Error in background streaming processing for job ${jobId}:`, error);
      await database.updateJobStatus(jobId, 'failed');
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

      // Update job's content type
      await database.updateJobContentType(jobId, contentType);

      // Get total URL count
      const totalUrls = await database.getUrlCountByJob(jobId);
      
      if (totalUrls === 0) {
        res.status(400).json({ error: 'No URLs found for this job' });
        return;
      }

      // Update job status to processing and reset counters
      await database.updateJobStatus(jobId, 'processing', 0, 0);

      // Reset all URL statuses to pending for this job
      await database.resetUrlStatusesForJob(jobId);

      // Emit job start event
      progressEmitter.emitJobStart(jobId, totalUrls);

      // For large jobs, use streaming processing
      if (totalUrls > config.batchSize) {
        await this.startStreamingProcessing(jobId, contentType as ContentType, totalUrls);
      } else {
        // For small jobs, use the original method
        const urls = await database.getUrlsByJob(jobId);
        const urlRecords = urls.map(url => ({
          id: url.id,
          url: url.url
        }));

        // Add chunked jobs to the queue
        await addChunkedJobs(jobId, urlRecords, contentType as ContentType);
      }

      logger.info(`Started processing job ${jobId} with ${totalUrls} URLs`);

      res.json({
        jobId,
        message: 'Processing started',
        totalUrls,
        streaming: totalUrls > config.batchSize
      });
    } catch (error) {
      logger.error('Start processing error:', error);
      res.status(500).json({
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async startStreamingProcessing(jobId: string, contentType: ContentType, totalUrls: number): Promise<void> {
    logger.info(`Starting streaming processing for job ${jobId} with ${totalUrls} URLs`);
    
    const batchSize = config.batchSize;
    let offset = 0;
    let processedBatches = 0;

    while (offset < totalUrls) {
      // Check if job was cancelled
      const job = await database.getJob(jobId);
      if (!job || job.status === 'stopped') {
        logger.info(`Job ${jobId} was cancelled, stopping streaming processing`);
        break;
      }

      // Get batch of URLs
      const urlBatch = await database.getUrlsByJobPaginated(jobId, offset, batchSize);
      
      if (urlBatch.length === 0) {
        break;
      }

      const urlRecords = urlBatch.map(url => ({
        id: url.id,
        url: url.url
      }));

      // Add chunked jobs to the queue
      await addChunkedJobs(jobId, urlRecords, contentType);

      processedBatches++;
      offset += batchSize;

      logger.debug(`Added batch ${processedBatches} for job ${jobId}: ${urlRecords.length} URLs (${offset}/${totalUrls})`);

      // Small delay to prevent overwhelming the queue
      if (offset < totalUrls) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`Completed streaming processing setup for job ${jobId}: ${processedBatches} batches added to queue`);
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
      await database.updateJobStatus(jobId, 'stopped');

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


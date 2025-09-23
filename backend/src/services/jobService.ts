import { Queue, Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { JobData, CSVRow, ContentType } from '../types';
import { OpenAIService } from './openaiService';
import { CSVService } from './csvService';
import { redis } from './redis';
import { config } from '../config';
import path from 'path';

export class JobService {
  private queue: Queue;
  private worker: Worker;
  private openaiService: OpenAIService;
  private csvService: CSVService;
  private jobs: Map<string, JobData> = new Map();
  private jobRows: Map<string, CSVRow[]> = new Map();

  constructor() {
    this.openaiService = new OpenAIService();
    this.csvService = new CSVService();

    // Initialize BullMQ queue
    this.queue = new Queue('csv-opener-queue', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.retryDelay,
        },
      },
    });

    // Initialize worker
    this.worker = new Worker(
      'csv-opener-queue',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: config.maxConcurrentJobs,
      }
    );

    this.setupWorkerEvents();
  }

  private setupWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  async createJob(
    fileName: string,
    filePath: string,
    urlColumn: string,
    contentType: ContentType
  ): Promise<string> {
    const jobId = uuidv4();
    
    try {
      // Parse CSV
      const { rows, columns } = await this.csvService.parseCSV(filePath);
      
      // Validate URLs
      const { validRows, invalidRows } = await this.csvService.validateAndSetUrls(rows, urlColumn);
      
      // Mark invalid rows as failed
      invalidRows.forEach(row => {
        row.status = 'failed';
        row.error = row.error || 'Invalid URL';
      });

      // Create job data
      const jobData: JobData = {
        jobId,
        fileName,
        contentType,
        totalRows: rows.length,
        processedRows: 0,
        failedRows: invalidRows.length,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store job and rows
      this.jobs.set(jobId, jobData);
      this.jobRows.set(jobId, rows);

      // Add job to queue
      await this.queue.add('process-csv', {
        jobId,
        validRows,
        invalidRows,
        contentType,
      }, {
        jobId,
      });

      return jobId;
    } catch (error) {
      console.error('Error creating job:', error);
      throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processJob(job: Job): Promise<void> {
    const { jobId, validRows, invalidRows, contentType } = job.data;
    
    try {
      const jobData = this.jobs.get(jobId);
      if (!jobData) {
        throw new Error('Job not found');
      }

      jobData.status = 'processing';
      jobData.updatedAt = new Date();
      this.jobs.set(jobId, jobData);

      // Process valid rows
      const allRows = [...validRows, ...invalidRows];
      this.jobRows.set(jobId, allRows);

      for (const row of validRows) {
        try {
          row.status = 'processing';
          row.updatedAt = new Date();

          const result = await this.openaiService.generateOpenerWithRetry(
            row.url,
            contentType,
            parseInt(process.env.MAX_RETRIES || '3')
          );

          row.opener = result.opener;
          row.status = 'completed';
          row.updatedAt = new Date();
          
          jobData.processedRows++;
          jobData.updatedAt = new Date();
          this.jobs.set(jobId, jobData);

        } catch (error) {
          row.status = 'failed';
          row.error = error instanceof Error ? error.message : 'Unknown error';
          row.retryCount++;
          row.updatedAt = new Date();
          
          jobData.failedRows++;
          jobData.updatedAt = new Date();
          this.jobs.set(jobId, jobData);
        }
      }

      // Export results
      const outputPath = await this.csvService.exportProcessedCSV(jobId, allRows);
      
      jobData.status = 'completed';
      jobData.updatedAt = new Date();
      this.jobs.set(jobId, jobData);

      console.log(`Job ${jobId} completed. Results saved to: ${outputPath}`);

    } catch (error) {
      const jobData = this.jobs.get(jobId);
      if (jobData) {
        jobData.status = 'failed';
        jobData.error = error instanceof Error ? error.message : 'Unknown error';
        jobData.updatedAt = new Date();
        this.jobs.set(jobId, jobData);
      }
      throw error;
    }
  }

  getJobStatus(jobId: string): JobData | null {
    return this.jobs.get(jobId) || null;
  }

  getJobRows(jobId: string): CSVRow[] | null {
    return this.jobRows.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
      }

      const jobData = this.jobs.get(jobId);
      if (jobData) {
        jobData.status = 'cancelled';
        jobData.updatedAt = new Date();
        this.jobs.set(jobId, jobData);
      }

      return true;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  async getJobProgress(jobId: string): Promise<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
    status: string;
  } | null> {
    const jobData = this.jobs.get(jobId);
    if (!jobData) {
      return null;
    }

    const rows = this.jobRows.get(jobId) || [];
    const pending = rows.filter(row => row.status === 'pending' || row.status === 'processing').length;

    return {
      total: jobData.totalRows,
      processed: jobData.processedRows,
      failed: jobData.failedRows,
      pending,
      status: jobData.status,
    };
  }

  async cleanup(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}


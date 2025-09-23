import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { database } from './database';
import { OpenAIService } from './openaiService';
import { v4 as uuidv4 } from 'uuid';

export interface ChunkJobData {
  jobId: string;
  chunk: number;
  urls: Array<{
    id: string;
    url: string;
  }>;
  contentType: 'company' | 'person' | 'news';
}

// Create the main CSV processing queue
export const csvProcessingQueue = new Queue('csv-processing', {
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

// Create worker to process CSV chunks
export const csvProcessingWorker = new Worker(
  'csv-processing',
  async (job: Job<ChunkJobData>) => {
    const { jobId, chunk, urls, contentType } = job.data;
    
    logger.info(`Processing chunk ${chunk} for job ${jobId} with ${urls.length} URLs`);
    
    const openaiService = new OpenAIService();
    let processedCount = 0;
    let failedCount = 0;

    for (const urlRecord of urls) {
      try {
        // Update URL status to processing
        await database.updateUrlStatus(urlRecord.id, 'processing');

        // Generate opener with retry logic
        const result = await openaiService.generateOpenerWithRetry(
          urlRecord.url,
          contentType,
          config.maxRetries
        );

        // Update URL with success
        await database.updateUrlStatus(
          urlRecord.id,
          'completed',
          result.opener,
          undefined,
          0
        );

        processedCount++;
        logger.debug(`Successfully processed URL: ${urlRecord.url}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update URL with failure
        await database.updateUrlStatus(
          urlRecord.id,
          'failed',
          undefined,
          errorMessage,
          1 // retry_count
        );

        failedCount++;
        logger.error(`Failed to process URL ${urlRecord.url}:`, errorMessage);
      }
    }

    // Update job progress
    const jobRecord = await database.getJob(jobId);
    if (jobRecord) {
      const newProcessedRows = jobRecord.processed_rows + processedCount;
      const newFailedRows = jobRecord.failed_rows + failedCount;
      
      await database.updateJobStatus(
        jobId,
        'processing',
        newProcessedRows,
        newFailedRows
      );

      // Check if job is complete
      if (newProcessedRows + newFailedRows >= jobRecord.total_rows) {
        await database.updateJobStatus(jobId, 'completed');
        logger.info(`Job ${jobId} completed successfully`);
      }
    }

    return {
      processed: processedCount,
      failed: failedCount,
      chunk
    };
  },
  {
    connection: redis,
    concurrency: config.maxConcurrentJobs,
  }
);

// Worker event handlers
csvProcessingWorker.on('completed', (job) => {
  logger.info(`Chunk job ${job.id} completed successfully`);
});

csvProcessingWorker.on('failed', (job, err) => {
  logger.error(`Chunk job ${job?.id} failed:`, err.message);
  
  // Update job status to failed if this was a critical failure
  if (job?.data?.jobId) {
    database.updateJobStatus(job.data.jobId, 'failed');
  }
});

csvProcessingWorker.on('error', (err) => {
  logger.error('CSV processing worker error:', err);
});

// Queue event handlers
csvProcessingQueue.on('error', (error) => {
  logger.error('CSV processing queue error:', error);
});

// Helper function to add chunked jobs to the queue
export async function addChunkedJobs(
  jobId: string,
  urls: Array<{ id: string; url: string }>,
  contentType: 'company' | 'person' | 'news',
  chunkSize: number = 500
): Promise<void> {
  const chunks: Array<{ id: string; url: string }[]> = [];
  
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }

  logger.info(`Adding ${chunks.length} chunks for job ${jobId}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunkData: ChunkJobData = {
      jobId,
      chunk: i + 1,
      urls: chunks[i],
      contentType
    };

    await csvProcessingQueue.add(
      'process-chunk',
      chunkData,
      {
        jobId: `${jobId}-chunk-${i + 1}`,
        priority: 1,
      }
    );
  }
}

export default csvProcessingQueue;


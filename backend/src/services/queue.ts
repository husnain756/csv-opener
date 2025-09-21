import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { processCsvRow } from '../workers/csvProcessor';

// Create the main job queue
export const jobQueue = new Queue('csv-opener-jobs', {
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

// Create worker to process jobs
export const jobWorker = new Worker(
  'csv-opener-jobs',
  async (job: Job) => {
    const { type, data } = job.data;
    
    switch (type) {
      case 'process-csv-row':
        return await processCsvRow(data, job.id || 'unknown');
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  },
  {
    connection: redis,
    concurrency: config.maxConcurrentJobs,
  }
);

// Worker event handlers
jobWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

jobWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err.message);
});

jobWorker.on('error', (err) => {
  logger.error('Worker error:', err);
});

// Queue event handlers
jobQueue.on('error', (error) => {
  logger.error('Queue error:', error);
});

export default jobQueue;


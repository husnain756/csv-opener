import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { database } from './database';
import { OpenAIService } from './openaiService';
import { progressEmitter } from './progressEmitter';
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
    
    // Defensive check for malformed job data
    if (!jobId || !chunk || !urls || !Array.isArray(urls) || !contentType) {
      logger.error(`Worker received malformed job: ${job.id}`, {
        jobId: typeof jobId,
        chunk: typeof chunk,
        urls: typeof urls,
        contentType: typeof contentType,
        data: job.data
      });
      throw new Error(`Invalid job data: missing required properties`);
    }
    
    logger.info(`Worker received job: ${job.id} for jobId: ${jobId}, chunk: ${chunk}, URLs: ${urls.length}`);
    
    // Check if this job has been marked for stopping
    if ((job.data as any).stopped) {
      logger.info(`Job ${jobId} chunk ${chunk} was marked for stopping, skipping processing`);
      return {
        processed: 0,
        failed: 0,
        chunk,
        stopped: true
      };
    }
    
    logger.info(`Processing chunk ${chunk} for job ${jobId} with ${urls.length} URLs`);
    
    const openaiService = new OpenAIService();
    let processedCount = 0;
    let failedCount = 0;

    for (const urlRecord of urls) {
      try {
        // Check if job has been stopped before processing each URL
        const jobRecord = await database.getJob(jobId);
        if (!jobRecord || jobRecord.status === 'stopped') {
          logger.info(`Job ${jobId} has been stopped, stopping processing`);
          break;
        }

        // Check if this job chunk has been marked for stopping
        if ((job.data as any).stopped) {
          logger.info(`Job ${jobId} chunk ${chunk} was marked for stopping, removing chunk and stopping processing`);
          // Remove this chunk from the queue immediately
          try {
            await job.remove();
            logger.info(`Removed stopped chunk ${job.id} from queue`);
          } catch (removeError) {
            logger.warn(`Could not remove stopped chunk ${job.id}:`, removeError);
          }
          break;
        }

        // Update URL status to processing
        await database.updateUrlStatus(urlRecord.id, 'processing');

        // Generate opener with retry logic
        const result = await openaiService.generateOpenerWithRetry(
          urlRecord.url,
          contentType,
          config.maxRetries
        );

        // Update URL with success
        logger.debug(`Updating URL ${urlRecord.id} to completed status`);
        await database.updateUrlStatus(
          urlRecord.id,
          'completed',
          result.opener,
          undefined,
          0
        );
        logger.debug(`Successfully updated URL ${urlRecord.id} in database`);

        processedCount++;
        logger.debug(`Successfully processed URL: ${urlRecord.url}`);

        // Emit real-time progress update after each URL is processed
        const currentProgress = await database.getJobProgress(jobId);
        if (currentProgress) {
          progressEmitter.emitUrlProgress(
            jobId,
            currentProgress.processed,
            currentProgress.failed,
            currentProgress.pending,
            urlRecord.url
          );
        }

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

        // Emit real-time progress update after each failed URL
        const currentProgress = await database.getJobProgress(jobId);
        if (currentProgress) {
          progressEmitter.emitUrlProgress(
            jobId,
            currentProgress.processed,
            currentProgress.failed,
            currentProgress.pending,
            urlRecord.url
          );
        }
      }
    }

    // Update job progress
    const jobRecord = await database.getJob(jobId);
    if (jobRecord) {
    // Check if job was stopped during processing
    if (jobRecord.status === 'stopped') {
      logger.info(`Job ${jobId} was stopped during processing, stopping`);
      return {
        processed: processedCount,
        failed: failedCount,
        chunk,
        stopped: true
      };
    }

      const newProcessedRows = jobRecord.processed_rows + processedCount;
      const newFailedRows = jobRecord.failed_rows + failedCount;
      
      await database.updateJobStatus(
        jobId,
        'processing',
        newProcessedRows,
        newFailedRows
      );

      // Note: Progress updates are now emitted after each individual URL is processed
      // No need to emit here as it would be duplicate

      // Check if job is complete
      if (newProcessedRows + newFailedRows >= jobRecord.total_rows) {
        await database.updateJobStatus(jobId, 'completed');
        progressEmitter.emitJobComplete(jobId, newProcessedRows, newFailedRows);
        logger.info(`Job ${jobId} completed successfully`);
        
        // Automatically clean up completed job chunks
        setTimeout(async () => {
          try {
            await cleanupJob(jobId);
            logger.info(`Automatically cleaned up completed job ${jobId}`);
          } catch (error) {
            logger.warn(`Failed to auto-cleanup completed job ${jobId}:`, error);
          }
        }, 5000); // Clean up after 5 seconds
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
    
    // Automatically clean up failed job chunks after a delay
    setTimeout(async () => {
      try {
        await cleanupJob(job.data.jobId);
        logger.info(`Automatically cleaned up failed job ${job.data.jobId}`);
      } catch (error) {
        logger.warn(`Failed to auto-cleanup failed job ${job.data.jobId}:`, error);
      }
    }, 10000); // Clean up after 10 seconds
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
  try {
    logger.info(`addChunkedJobs called for job ${jobId} with ${urls.length} URLs`);
    
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

      logger.info(`Adding chunk ${i + 1} with ${chunks[i].length} URLs to queue`);
      
      const job = await csvProcessingQueue.add(
      'process-chunk',
      chunkData,
      {
        jobId: `${jobId}-chunk-${i + 1}`,
        priority: 1,
      }
    );
      
      logger.info(`Successfully added chunk job ${job.id} to queue`);
    }
    
    logger.info(`Successfully added all ${chunks.length} chunks for job ${jobId}`);
  } catch (error) {
    logger.error(`Error in addChunkedJobs for job ${jobId}:`, error);
    throw error;
  }
}

// Add error handlers for the worker
csvProcessingWorker.on('error', (error) => {
  logger.error('CSV processing worker error:', error);
});

csvProcessingWorker.on('failed', (job, error) => {
  logger.error(`CSV processing job ${job?.id} failed:`, error);
});

csvProcessingWorker.on('completed', (job) => {
  logger.info(`CSV processing job ${job.id} completed successfully`);
});

csvProcessingWorker.on('ready', () => {
  logger.info('CSV processing worker is ready and listening for jobs');
});

// Function to stop a job and all its chunks
export async function stopJob(jobId: string): Promise<boolean> {
  try {
    // Get all jobs for this jobId
    const jobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
    const jobChunks = jobs.filter(job => job.data.jobId === jobId);
    
    logger.info(`Stopping ${jobChunks.length} chunks for job ${jobId}`);
    
    let removedCount = 0;
    let failedCount = 0;

    // Remove all chunks from the queue
    for (const job of jobChunks) {
      try {
        // Try to remove the job
        await job.remove();
        removedCount++;
        logger.info(`Removed chunk job ${job.id} from queue`);
      } catch (removeError) {
        failedCount++;
        logger.warn(`Could not remove chunk job ${job.id}: ${removeError instanceof Error ? removeError.message : 'Unknown error'}`);
        
        // If the job is locked (being processed), try to mark it as stopped
        if (job.data && job.data.jobId === jobId) {
          try {
            // Update the job data to indicate it should be stopped
            await job.updateData({ ...job.data, stopped: true });
            logger.info(`Marked chunk job ${job.id} for stopping`);
          } catch (updateError) {
            logger.error(`Could not mark chunk job ${job.id} for stopping:`, updateError);
          }
        }
      }
    }
    
    // Get current progress from URLs table and update job table
    const currentProgress = await database.getJobProgress(jobId);
    if (currentProgress) {
      // Update job table with correct progress counters before setting status to stopped
      await database.updateJobProgress(jobId, currentProgress.processed, currentProgress.failed);
      
      // Now set status to stopped
      await database.updateJobStatus(jobId, 'stopped');
      
      // Emit stopped status with current progress
      progressEmitter.emitJobStopped(
        jobId,
        currentProgress.processed,
        currentProgress.failed,
        currentProgress.pending
      );
    } else {
      // Fallback: just set status to stopped if we can't get progress
      await database.updateJobStatus(jobId, 'stopped');
    }
    
    logger.info(`Job ${jobId} stopping completed: ${removedCount} chunks removed, ${failedCount} chunks marked for stopping`);
    
    // Automatically clean up stopped job chunks after a delay
    setTimeout(async () => {
      try {
        await cleanupJob(jobId);
        logger.info(`Automatically cleaned up stopped job ${jobId}`);
      } catch (error) {
        logger.warn(`Failed to auto-cleanup stopped job ${jobId}:`, error);
      }
    }, 15000); // Clean up after 15 seconds to allow for any remaining processing
    
    return true;
  } catch (error) {
    logger.error(`Error stopping job ${jobId}:`, error);
    return false;
  }
}

// Function to resume a stopped job
export async function resumeJob(jobId: string): Promise<boolean> {
  try {
    logger.info(`resumeJob called for job ${jobId}`);
    const job = await database.getJob(jobId);
    if (!job) {
      logger.error(`Job ${jobId} not found`);
      return false;
    }

    if (job.status !== 'stopped') {
      logger.error(`Job ${jobId} is not stopped, current status: ${job.status}`);
      return false;
    }

    // CRITICAL: Clean up any existing chunks for this job before resuming
    // This prevents the issue where old chunks with stopped:true remain in Redis
    logger.info(`Cleaning up existing chunks for job ${jobId} before resume`);
    
    try {
      const cleanupSuccess = await cleanupJob(jobId);
      if (!cleanupSuccess) {
        logger.warn(`Cleanup had issues for job ${jobId}, but continuing with resume`);
      }
    } catch (cleanupError) {
      logger.warn(`Cleanup failed for job ${jobId}, but continuing with resume:`, cleanupError);
    }
    
    // Force remove any remaining chunks using a more aggressive approach
    try {
      const remainingJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
      const remainingChunks = remainingJobs.filter(job => job && job.data && job.data.jobId === jobId);
      
      if (remainingChunks.length > 0) {
        logger.info(`Force removing ${remainingChunks.length} remaining chunks for job ${jobId}`);
        for (const chunk of remainingChunks) {
          try {
            await chunk.remove();
            logger.info(`Force removed chunk ${chunk.id}`);
          } catch (error) {
            logger.warn(`Could not force remove chunk ${chunk.id}:`, error);
          }
        }
      }
    } catch (forceCleanupError) {
      logger.warn(`Force cleanup failed for job ${jobId}:`, forceCleanupError);
    }

    // Get remaining URLs to process
    const remainingUrls = await database.getUrlsByJob(jobId);
    const pendingUrls = remainingUrls.filter(url => url.status === 'pending' || url.status === 'failed');
    const completedUrls = remainingUrls.filter(url => url.status === 'completed');
    const failedUrls = remainingUrls.filter(url => url.status === 'failed');

    if (pendingUrls.length === 0) {
      logger.info(`No pending URLs to resume for job ${jobId}`);
      await database.updateJobStatus(jobId, 'completed');
      return true;
    }

    // Update job status to processing and fix the progress counts
    await database.updateJobStatus(jobId, 'processing');
    
    // Update the processed and failed counts to reflect current state
    await database.updateJobProgress(jobId, completedUrls.length, failedUrls.length);

    // Add new chunks to the queue
    logger.info(`About to call addChunkedJobs for job ${jobId} with ${pendingUrls.length} pending URLs`);
    await addChunkedJobs(jobId, pendingUrls, job.content_type);
    logger.info(`addChunkedJobs completed for job ${jobId}`);

    // Check if chunks were actually added to the queue
    const queueJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
    const jobChunks = queueJobs.filter(queueJob => queueJob.data.jobId === jobId);
    logger.info(`Queue check: Found ${jobChunks.length} chunks in queue for job ${jobId}`);

    logger.info(`Resumed job ${jobId} with ${pendingUrls.length} pending URLs (${completedUrls.length} already completed, ${failedUrls.length} failed)`);
    return true;
  } catch (error) {
    logger.error(`Error resuming job ${jobId}:`, error);
    return false;
  }
}

// Function to cleanup all queue chunks for a job (used when deleting and resuming)
export async function cleanupJob(jobId: string): Promise<boolean> {
  try {
    logger.info(`Starting aggressive cleanup for job ${jobId}`);
    
    // Multiple cleanup attempts to ensure all chunks are removed
    let totalRemoved = 0;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      logger.info(`Cleanup attempt ${attempts}/${maxAttempts} for job ${jobId}`);
      
      // Get all jobs for this jobId from all possible states
      const jobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
      const jobChunks = jobs.filter(job => job.data && job.data.jobId === jobId);
      
      if (jobChunks.length === 0) {
        logger.info(`No chunks found for job ${jobId} on attempt ${attempts}`);
        break;
      }
      
      logger.info(`Found ${jobChunks.length} chunks for job ${jobId} on attempt ${attempts}`);
      
      let removedCount = 0;
      let failedCount = 0;

      // Remove all chunks from the queue
      for (const job of jobChunks) {
        if (!job) {
          // Skip undefined/null jobs
          continue;
        }
        
        try {
          // Force remove the job
          await job.remove();
          removedCount++;
          totalRemoved++;
          logger.info(`Removed chunk job ${job.id} from queue`);
        } catch (removeError) {
          failedCount++;
          logger.warn(`Could not remove chunk job ${job.id}: ${removeError instanceof Error ? removeError.message : 'Unknown error'}`);
          
          // If the job is locked (being processed), try to mark it as stopped
          if (job.data && job.data.jobId === jobId) {
            try {
              // Update the job data to indicate it should be stopped
              await job.updateData({ ...job.data, stopped: true });
              logger.info(`Marked chunk job ${job.id} for stopping (will be cleaned up when worker finishes)`);
            } catch (updateError) {
              logger.error(`Could not mark chunk job ${job.id} for stopping:`, updateError);
            }
          }
        }
      }
      
      logger.info(`Attempt ${attempts}: ${removedCount} chunks removed, ${failedCount} chunks failed to remove`);
      
      // Wait a bit for Redis to process the removals
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final verification - check if any chunks remain
    const finalJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    const remainingChunks = finalJobs.filter(job => job.data && job.data.jobId === jobId);
    
    if (remainingChunks.length > 0) {
      logger.warn(`Warning: ${remainingChunks.length} chunks still remain for job ${jobId} after cleanup`);
      return false;
    }
    
    logger.info(`Job ${jobId} cleanup completed successfully: ${totalRemoved} total chunks removed`);
    return true;
  } catch (error) {
    logger.error(`Error cleaning up job ${jobId}:`, error);
    return false;
  }
}

// Function to clean up corrupted jobs and bad data from Redis
export async function cleanupCorruptedJobs(): Promise<void> {
  try {
    logger.info('Starting corrupted jobs cleanup');
    
    // Get all jobs from all states
    const allJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    
    let corruptedJobsRemoved = 0;
    let orphanedJobsRemoved = 0;
    let validJobsFound = 0;
    
    // First pass: Remove corrupted jobs (jobs without data)
    for (const job of allJobs) {
      if (!job) {
        // Skip undefined/null jobs
        continue;
      }
      
      if (!job.data) {
        try {
          await job.remove();
          corruptedJobsRemoved++;
          logger.info(`Removed corrupted job ${job.id} (no data)`);
        } catch (error) {
          logger.warn(`Could not remove corrupted job ${job.id}:`, error);
        }
      } else {
        validJobsFound++;
      }
    }
    
    logger.info(`Corrupted jobs cleanup: ${corruptedJobsRemoved} corrupted jobs removed, ${validJobsFound} valid jobs found`);
    
    // Second pass: Clean up orphaned jobs (jobs that don't exist in database)
    const remainingJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    
    for (const job of remainingJobs) {
      if (!job) {
        // Skip undefined/null jobs
        continue;
      }
      
      if (job.data && job.data.jobId) {
        try {
          // Check if the job exists in database
          const dbJob = await database.getJob(job.data.jobId);
          
          if (!dbJob) {
            // Job doesn't exist in database, it's orphaned
            await job.remove();
            orphanedJobsRemoved++;
            logger.info(`Removed orphaned job ${job.id} for non-existent job ${job.data.jobId}`);
          }
        } catch (error) {
          logger.warn(`Could not check/remove orphaned job ${job.id}:`, error);
        }
      }
    }
    
    logger.info(`Orphaned jobs cleanup: ${orphanedJobsRemoved} orphaned jobs removed`);
    logger.info(`Total cleanup completed: ${corruptedJobsRemoved + orphanedJobsRemoved} bad jobs removed`);
    
  } catch (error) {
    logger.error('Error during corrupted jobs cleanup:', error);
  }
}

// Periodic cleanup function to remove old chunks that might be stuck
export async function periodicCleanup(): Promise<void> {
  try {
    logger.info('Starting periodic queue cleanup');
    
    // First, clean up corrupted jobs
    await cleanupCorruptedJobs();
    
    // Get all remaining jobs from all states
    const allJobs = await csvProcessingQueue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    
    // Group jobs by jobId
    const jobsByJobId = new Map<string, Job[]>();
    for (const job of allJobs) {
      if (!job) {
        // Skip undefined/null jobs
        continue;
      }
      
      if (job.data && job.data.jobId) {
        const jobId = job.data.jobId;
        if (!jobsByJobId.has(jobId)) {
          jobsByJobId.set(jobId, []);
        }
        jobsByJobId.get(jobId)!.push(job);
      }
    }
    
    let totalCleaned = 0;
    
    // Check each job group
    for (const [jobId, chunks] of jobsByJobId) {
      try {
        // Check if the job exists in database
        const job = await database.getJob(jobId);
        
        if (!job) {
          // Job doesn't exist in database, clean up all chunks
          logger.info(`Job ${jobId} not found in database, cleaning up ${chunks.length} orphaned chunks`);
          for (const chunk of chunks) {
            try {
              await chunk.remove();
              totalCleaned++;
            } catch (error) {
              logger.warn(`Could not remove orphaned chunk ${chunk.id}:`, error);
            }
          }
        } else if (job.status === 'completed' || job.status === 'failed') {
          // Job is finished, clean up any remaining chunks
          logger.info(`Job ${jobId} is ${job.status}, cleaning up ${chunks.length} remaining chunks`);
          for (const chunk of chunks) {
            try {
              await chunk.remove();
              totalCleaned++;
            } catch (error) {
              logger.warn(`Could not remove finished job chunk ${chunk.id}:`, error);
            }
          }
        }
      } catch (error) {
        logger.error(`Error during cleanup for job ${jobId}:`, error);
      }
    }
    
    if (totalCleaned > 0) {
      logger.info(`Periodic cleanup completed: ${totalCleaned} chunks removed`);
    }
  } catch (error) {
    logger.error('Error during periodic cleanup:', error);
  }
}

// Start periodic cleanup every 5 minutes
setInterval(periodicCleanup, 5 * 60 * 1000);

// Run initial cleanup on startup
setTimeout(periodicCleanup, 10000); // Run after 10 seconds to let the app fully start

export default csvProcessingQueue;


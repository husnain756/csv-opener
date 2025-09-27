import { Router } from 'express';
import { database } from '../services/database';
import { logger } from '../utils/logger';
import { pollingRateLimiter } from '../middleware/rateLimiter';
import { progressEmitter, JobProgressUpdate } from '../services/progressEmitter';
import { stopJob, resumeJob, cleanupJob } from '../services/queue';

const router = Router();

// Apply polling rate limiter to all job status endpoints except SSE
router.use((req, res, next) => {
  // Skip rate limiting for SSE endpoints
  if (req.path.includes('/stream')) {
    return next();
  }
  return pollingRateLimiter(req, res, next);
});

// Get job status
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const progress = await database.getJobProgress(jobId);
    
    return res.json({
      jobId: job.id,
      status: job.status,
      progress,
      fileName: job.file_name,
      totalRows: job.total_rows,
      processedRows: job.processed_rows,
      failedRows: job.failed_rows,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    });
  } catch (error) {
    logger.error('Get job status error:', error);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Get job results
router.get('/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const results = await database.getJobResults(jobId);
    
    return res.json(results);
  } catch (error) {
    logger.error('Get job results error:', error);
    return res.status(500).json({ error: 'Failed to get job results' });
  }
});

// Download job results
router.get('/:jobId/download', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job is not completed yet' });
    }

    // Get results from database
    const results = await database.getJobResults(jobId);
    
    // Generate CSV content
    const csvContent = generateResultsCSV(results.urls);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${job.file_name}_results.csv"`);
    return res.send(csvContent);
  } catch (error) {
    logger.error('Download results error:', error);
    return res.status(500).json({
      error: 'Failed to download results',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Download original uploaded file
router.get('/:jobId/download-original', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if original file exists
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(job.file_path)) {
      return res.status(404).json({ error: 'Original file not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${job.file_name}"`);
    
    // Stream the original file
    return res.sendFile(path.resolve(job.file_path));
  } catch (error) {
    logger.error('Download original file error:', error);
    return res.status(500).json({
      error: 'Failed to download original file',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cancel job
router.post('/:jobId/stop', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: 'Cannot stop completed job' });
    }

    if (job.status === 'stopped') {
      return res.status(400).json({ error: 'Job is already stopped' });
    }

    // Stop the job using the queue service
    const stopped = await stopJob(jobId);

    if (!stopped) {
      return res.status(500).json({ error: 'Failed to stop job' });
    }

    logger.info(`Job ${jobId} stopped successfully`);

    return res.json({ message: 'Job stopped successfully' });
  } catch (error) {
    logger.error('Stop job error:', error);
    return res.status(500).json({
      error: 'Failed to stop job',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/:jobId/resume', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'stopped') {
      return res.status(400).json({ error: 'Can only resume stopped jobs' });
    }

    // Resume the job using the queue service
    const resumed = await resumeJob(jobId);

    if (!resumed) {
      return res.status(500).json({ error: 'Failed to resume job' });
    }

    logger.info(`Job ${jobId} resumed successfully`);

    return res.json({ message: 'Job resumed successfully' });
  } catch (error) {
    logger.error('Resume job error:', error);
    return res.status(500).json({
      error: 'Failed to resume job',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'processing') {
      return res.status(400).json({ error: 'Cannot delete processing job. Stop it first.' });
    }

    // Clean up any remaining queue chunks for this job
    await cleanupJob(jobId);

    // Delete the job and all its URLs
    await database.deleteJob(jobId);

    // Delete the CSV files
    const fs = require('fs');
    const path = require('path');
    
    try {
      if (fs.existsSync(job.file_path)) {
        fs.unlinkSync(job.file_path);
        logger.info(`Deleted original file: ${job.file_path}`);
      }
    } catch (fileError) {
      logger.warn(`Could not delete original file ${job.file_path}:`, fileError);
    }

    // Try to delete the processed file if it exists
    const processedFilePath = job.file_path.replace('.csv', '-processed.csv');
    try {
      if (fs.existsSync(processedFilePath)) {
        fs.unlinkSync(processedFilePath);
        logger.info(`Deleted processed file: ${processedFilePath}`);
      }
    } catch (fileError) {
      logger.warn(`Could not delete processed file ${processedFilePath}:`, fileError);
    }

    logger.info(`Job ${jobId} deleted successfully`);

    return res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    logger.error('Delete job error:', error);
    return res.status(500).json({
      error: 'Failed to delete job',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper function to generate CSV content
function generateResultsCSV(urls: Array<{ url: string; status: string; opener?: string; error?: string }>): string {
  const headers = ['URL', 'Status', 'Generated Opener', 'Error'];
  const rows = urls.map(url => [
    url.url,
    url.status,
    url.opener || '',
    url.error || ''
  ]);
  
  const csvRows = [headers, ...rows].map(row => 
    row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(',')
  );
  
  return csvRows.join('\n');
}

// Retry failed URLs
router.post('/:jobId/retry', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { urlIds } = req.body;
    
    const job = await database.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    let retriedCount: number;
    
    if (urlIds && Array.isArray(urlIds) && urlIds.length > 0) {
      // Retry specific URLs
      retriedCount = await database.retrySpecificUrls(jobId, urlIds);
    } else {
      // Retry all failed URLs
      retriedCount = await database.retryFailedUrls(jobId);
    }

    return res.json({
      message: 'URLs retried successfully',
      retried: retriedCount,
      jobId
    });
  } catch (error) {
    logger.error('Retry failed URLs error:', error);
    return res.status(500).json({ error: 'Failed to retry failed URLs' });
  }
});

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await database.getAllJobs();
    res.json(jobs);
  } catch (error) {
    logger.error('Get all jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});


// SSE endpoint for real-time job progress
router.get('/:jobId/stream', async (req, res): Promise<void> => {
  const { jobId } = req.params;
  
  try {
    // Verify job exists
    const job = await database.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial job status
    const progress = await database.getJobProgress(jobId);
    if (!progress) {
      res.status(404).json({ error: 'Job progress not found' });
      return;
    }
    
    const initialUpdate: JobProgressUpdate = {
      jobId: job.id,
      status: job.status as any,
      progress: {
        total: progress.total,
        completed: progress.processed,
        failed: progress.failed,
        pending: progress.pending
      }
    };
    
    res.write(`data: ${JSON.stringify(initialUpdate)}\n\n`);

    // Set up progress listener
    const progressHandler = (update: JobProgressUpdate) => {
      try {
        res.write(`data: ${JSON.stringify(update)}\n\n`);
      } catch (error) {
        logger.error(`Error writing SSE data for job ${jobId}:`, error);
      }
    };

    // Listen for progress updates
    progressEmitter.on(`job-${jobId}`, progressHandler);

    // Handle client disconnect
    req.on('close', () => {
      logger.info(`SSE connection closed for job ${jobId}`);
      progressEmitter.removeListener(`job-${jobId}`, progressHandler);
    });

    // Handle connection errors
    req.on('error', (error) => {
      logger.error(`SSE connection error for job ${jobId}:`, error);
      progressEmitter.removeListener(`job-${jobId}`, progressHandler);
    });

    // Send keep-alive every 30 seconds
    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (error) {
        clearInterval(keepAlive);
        progressEmitter.removeListener(`job-${jobId}`, progressHandler);
      }
    }, 30000);

    // Clean up on job completion
    const checkCompletion = setInterval(async () => {
      try {
        const currentJob = await database.getJob(jobId);
        if (currentJob && ['completed', 'failed', 'stopped'].includes(currentJob.status)) {
          clearInterval(keepAlive);
          clearInterval(checkCompletion);
          progressEmitter.removeListener(`job-${jobId}`, progressHandler);
          
          // Send final update
          const finalProgress = await database.getJobProgress(jobId);
          if (finalProgress) {
            const finalUpdate: JobProgressUpdate = {
              jobId: currentJob.id,
              status: currentJob.status as any,
              progress: {
                total: finalProgress.total,
                completed: finalProgress.processed,
                failed: finalProgress.failed,
                pending: finalProgress.pending
              }
            };
            
            res.write(`data: ${JSON.stringify(finalUpdate)}\n\n`);
          }
          
          res.end();
        }
      } catch (error) {
        logger.error(`Error checking job completion for ${jobId}:`, error);
      }
    }, 5000);

  } catch (error) {
    logger.error(`SSE setup error for job ${jobId}:`, error);
    res.status(500).json({ error: 'Failed to setup SSE connection' });
  }
});

export default router;

import { Router } from 'express';
import { database } from '../services/database';
import { logger } from '../utils/logger';
import { pollingRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply polling rate limiter to all job status endpoints
router.use(pollingRateLimiter);

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

export default router;

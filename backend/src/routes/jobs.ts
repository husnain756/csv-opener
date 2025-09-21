import { Router } from 'express';
import { JobService } from '../services/jobService';

const router = Router();
const jobService = new JobService();

// Get job status
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobProgress = await jobService.getJobProgress(jobId);
    
    if (!jobProgress) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    return res.json(jobProgress);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Get all jobs (placeholder - would need to implement)
router.get('/', async (req, res) => {
  try {
    // For now, return empty array - would need to implement getAllJobs in JobService
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

export default router;

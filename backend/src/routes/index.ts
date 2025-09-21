import { Router } from 'express';
import { UploadController } from '../controllers/uploadController';
import { validateStartProcessing, validateJobId } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const uploadController = new UploadController();

// Upload CSV file
router.post('/upload', uploadController.getUploadMiddleware(), asyncHandler(uploadController.uploadCSV.bind(uploadController)));

// Start processing job
router.post('/process', validateStartProcessing, asyncHandler(uploadController.startProcessing.bind(uploadController)));

// Get job status
router.get('/jobs/:jobId/status', validateJobId, asyncHandler(uploadController.getJobStatus.bind(uploadController)));

// Download results
router.get('/jobs/:jobId/download', validateJobId, asyncHandler(uploadController.downloadResults.bind(uploadController)));

// Cancel job
router.delete('/jobs/:jobId', validateJobId, asyncHandler(uploadController.cancelJob.bind(uploadController)));

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router;


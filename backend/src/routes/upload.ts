import { Router } from 'express';
import { UploadController } from '../controllers/uploadController';

const router = Router();
const uploadController = new UploadController();

// Upload CSV file
router.post('/', 
  uploadController.getUploadMiddleware(),
  uploadController.uploadCSV.bind(uploadController)
);

// Start processing
router.post('/process', uploadController.startProcessing.bind(uploadController));

// Get job status
router.get('/:jobId/status', uploadController.getJobStatus.bind(uploadController));

// Download results
router.get('/:jobId/download', uploadController.downloadResults.bind(uploadController));

// Cancel job
router.post('/:jobId/cancel', uploadController.cancelJob.bind(uploadController));

// Retry failed URLs
router.post('/:jobId/retry', uploadController.retryFailedUrls.bind(uploadController));

export default router;

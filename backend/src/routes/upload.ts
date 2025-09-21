import { Router } from 'express';
import { UploadController } from '../controllers/uploadController';

const router = Router();
const uploadController = new UploadController();

// Upload CSV file
router.post('/', uploadController.uploadCSV.bind(uploadController));

export default router;

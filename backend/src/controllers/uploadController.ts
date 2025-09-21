import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JobService } from '../services/jobService';
import { CSVService } from '../services/csvService';
import { ContentType } from '../types';

export class UploadController {
  private jobService: JobService;
  private csvService: CSVService;
  private upload: multer.Multer;

  constructor() {
    this.jobService = new JobService();
    this.csvService = new CSVService();

    // Configure multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const jobId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${jobId}${ext}`);
      },
    });

    this.upload = multer({
      storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are allowed'));
        }
      },
    });
  }

  getUploadMiddleware() {
    return this.upload.single('csvFile');
  }

  async uploadCSV(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV file uploaded' });
        return;
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;

      // Parse CSV to get preview and columns
      const { rows, columns } = await this.csvService.parseCSV(filePath);
      const preview = this.csvService.getPreview(rows, 10);

      // Extract job ID from filename
      const jobId = path.basename(filePath, path.extname(filePath));

      res.json({
        jobId,
        fileName,
        totalRows: rows.length,
        preview,
        columns,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Failed to process CSV file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async startProcessing(req: Request, res: Response): Promise<void> {
    try {
      const { jobId, urlColumn, contentType } = req.body;

      if (!jobId || !urlColumn || !contentType) {
        res.status(400).json({
          error: 'Missing required fields: jobId, urlColumn, contentType',
        });
        return;
      }

      if (!['company', 'person', 'news'].includes(contentType)) {
        res.status(400).json({
          error: 'Invalid contentType. Must be one of: company, person, news',
        });
        return;
      }

      const filePath = path.join(
        process.env.UPLOAD_DIR || './uploads',
        `${jobId}.csv`
      );

      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'CSV file not found' });
        return;
      }

      // Create processing job
      const newJobId = await this.jobService.createJob(
        req.body.fileName || 'uploaded.csv',
        filePath,
        urlColumn,
        contentType as ContentType
      );

      res.json({
        jobId: newJobId,
        message: 'Processing started',
      });
    } catch (error) {
      console.error('Start processing error:', error);
      res.status(500).json({
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobData = this.jobService.getJobStatus(jobId);

      if (!jobData) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const progress = await this.jobService.getJobProgress(jobId);

      res.json({
        jobId: jobData.jobId,
        status: jobData.status,
        progress,
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
        error: jobData.error,
      });
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async downloadResults(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobData = this.jobService.getJobStatus(jobId);

      if (!jobData) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (jobData.status !== 'completed') {
        res.status(400).json({ error: 'Job is not completed yet' });
        return;
      }

      const outputPath = path.join(
        process.env.OUTPUT_DIR || './outputs',
        `${jobId}_results.csv`
      );

      const fs = require('fs');
      if (!fs.existsSync(outputPath)) {
        res.status(404).json({ error: 'Results file not found' });
        return;
      }

      res.download(outputPath, `${jobData.fileName}_results.csv`);
    } catch (error) {
      console.error('Download results error:', error);
      res.status(500).json({
        error: 'Failed to download results',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const success = await this.jobService.cancelJob(jobId);

      if (!success) {
        res.status(404).json({ error: 'Job not found or could not be cancelled' });
        return;
      }

      res.json({ message: 'Job cancelled successfully' });
    } catch (error) {
      console.error('Cancel job error:', error);
      res.status(500).json({
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}


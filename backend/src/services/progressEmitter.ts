import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface JobProgressUpdate {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  currentUrl?: string;
  error?: string;
  estimatedTimeRemaining?: number;
  cost?: {
    tokensUsed: number;
    estimatedCost: number;
  };
}

class ProgressEmitter extends EventEmitter {
  private static instance: ProgressEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow up to 100 listeners per event
  }

  public static getInstance(): ProgressEmitter {
    if (!ProgressEmitter.instance) {
      ProgressEmitter.instance = new ProgressEmitter();
    }
    return ProgressEmitter.instance;
  }

  public emitProgress(jobId: string, update: JobProgressUpdate): void {
    try {
      this.emit(`job-${jobId}`, update);
      logger.debug(`Progress emitted for job ${jobId}:`, update);
    } catch (error) {
      logger.error(`Error emitting progress for job ${jobId}:`, error);
    }
  }

  public emitJobStart(jobId: string, totalUrls: number): void {
    const update: JobProgressUpdate = {
      jobId,
      status: 'processing',
      progress: {
        total: totalUrls,
        completed: 0,
        failed: 0,
        pending: totalUrls
      }
    };
    this.emitProgress(jobId, update);
  }

  public emitJobComplete(jobId: string, totalCompleted: number, totalFailed: number): void {
    const update: JobProgressUpdate = {
      jobId,
      status: 'completed',
      progress: {
        total: totalCompleted + totalFailed,
        completed: totalCompleted,
        failed: totalFailed,
        pending: 0
      }
    };
    this.emitProgress(jobId, update);
  }

  public emitJobFailed(jobId: string, error: string): void {
    const update: JobProgressUpdate = {
      jobId,
      status: 'failed',
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0
      },
      error
    };
    this.emitProgress(jobId, update);
  }

  public emitUrlProgress(jobId: string, completed: number, failed: number, pending: number, currentUrl?: string): void {
    const update: JobProgressUpdate = {
      jobId,
      status: 'processing',
      progress: {
        total: completed + failed + pending,
        completed,
        failed,
        pending
      },
      currentUrl
    };
    this.emitProgress(jobId, update);
  }
}

export const progressEmitter = ProgressEmitter.getInstance();

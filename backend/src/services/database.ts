import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface JobRecord {
  id: string;
  file_name: string;
  file_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  progress: number;
  created_at: Date;
  updated_at: Date;
}

export interface UrlRecord {
  id: string;
  job_id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  opener?: string;
  error?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/csv_opener',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Create jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          total_rows INTEGER NOT NULL DEFAULT 0,
          processed_rows INTEGER NOT NULL DEFAULT 0,
          failed_rows INTEGER NOT NULL DEFAULT 0,
          progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create urls table
      await client.query(`
        CREATE TABLE IF NOT EXISTS urls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          opener TEXT,
          error TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_urls_job_id ON urls(job_id);
        CREATE INDEX IF NOT EXISTS idx_urls_status ON urls(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
      `);

      client.release();
      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
      throw error;
    }
  }

  async createJob(
    fileName: string,
    filePath: string,
    totalRows: number
  ): Promise<string> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO jobs (file_name, file_path, total_rows, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [fileName, filePath, totalRows]
      );
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async createUrls(jobId: string, urls: string[]): Promise<void> {
    if (urls.length === 0) {
      return; // No URLs to insert
    }

    const client = await this.pool.connect();
    try {
      // Use parameterized query to avoid SQL injection
      const values = urls.map((_, index) => `($1, $${index + 2}, 'pending')`).join(',');
      const params = [jobId, ...urls];
      await client.query(
        `INSERT INTO urls (job_id, url, status) VALUES ${values}`,
        params
      );
    } finally {
      client.release();
    }
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM jobs WHERE id = $1',
        [jobId]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async updateJobStatus(
    jobId: string,
    status: JobRecord['status'],
    processedRows?: number,
    failedRows?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updates = ['status = $2', 'updated_at = NOW()'];
      const values = [jobId, status];
      let paramIndex = 3;

      if (processedRows !== undefined) {
        updates.push(`processed_rows = $${paramIndex++}`);
        values.push(processedRows.toString());
      }

      if (failedRows !== undefined) {
        updates.push(`failed_rows = $${paramIndex++}`);
        values.push(failedRows.toString());
      }

      // Calculate progress
      const job = await this.getJob(jobId);
      if (job) {
        const progress = job.total_rows > 0 ? 
          ((processedRows || job.processed_rows) / job.total_rows) * 100 : 0;
        updates.push(`progress = $${paramIndex++}`);
        values.push(progress.toString());
      }

      await client.query(
        `UPDATE jobs SET ${updates.join(', ')} WHERE id = $1`,
        values
      );
    } finally {
      client.release();
    }
  }

  async updateUrlStatus(
    urlId: string,
    status: UrlRecord['status'],
    opener?: string,
    error?: string,
    retryCount?: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updates = ['status = $2', 'updated_at = NOW()'];
      const values = [urlId, status];
      let paramIndex = 3;

      if (opener !== undefined) {
        updates.push(`opener = $${paramIndex++}`);
        values.push(opener);
      }

      if (error !== undefined) {
        updates.push(`error = $${paramIndex++}`);
        values.push(error);
      }

      if (retryCount !== undefined) {
        updates.push(`retry_count = $${paramIndex++}`);
        values.push(retryCount.toString());
      }

      await client.query(
        `UPDATE urls SET ${updates.join(', ')} WHERE id = $1`,
        values
      );
    } finally {
      client.release();
    }
  }

  async getUrlsByJob(jobId: string): Promise<UrlRecord[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM urls WHERE job_id = $1 ORDER BY created_at',
        [jobId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getFailedUrls(jobId: string): Promise<UrlRecord[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM urls WHERE job_id = $1 AND status = $2',
        [jobId, 'failed']
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getJobProgress(jobId: string): Promise<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
    status: string;
  } | null> {
    const client = await this.pool.connect();
    try {
      const jobResult = await client.query(
        'SELECT * FROM jobs WHERE id = $1',
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        return null;
      }

      const job = jobResult.rows[0];
      const urlStats = await client.query(
        `SELECT status, COUNT(*) as count 
         FROM urls 
         WHERE job_id = $1 
         GROUP BY status`,
        [jobId]
      );

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      };

      urlStats.rows.forEach((row: any) => {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      });

      return {
        total: job.total_rows,
        processed: stats.completed,
        failed: stats.failed,
        pending: stats.pending + stats.processing,
        status: job.status
      };
    } finally {
      client.release();
    }
  }

  async getJobResults(jobId: string): Promise<{
    urls: Array<{
      url: string;
      status: string;
      opener?: string;
      error?: string;
    }>;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT url, status, opener, error FROM urls WHERE job_id = $1 ORDER BY created_at',
        [jobId]
      );

      return {
        urls: result.rows
      };
    } finally {
      client.release();
    }
  }

  async retryFailedUrls(jobId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE urls 
         SET status = 'pending', error = NULL, updated_at = NOW()
         WHERE job_id = $1 AND status = 'failed'
         RETURNING id`,
        [jobId]
      );

      // Reset job status to processing if it was completed/failed
      await client.query(
        `UPDATE jobs 
         SET status = 'processing', updated_at = NOW()
         WHERE id = $1 AND status IN ('completed', 'failed')`,
        [jobId]
      );

      return result.rows.length;
    } finally {
      client.release();
    }
  }

  async retrySpecificUrls(jobId: string, urlIds: string[]): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Create placeholders for the IN clause
      const placeholders = urlIds.map((_, index) => `$${index + 2}`).join(',');
      
      const result = await client.query(
        `UPDATE urls 
         SET status = 'pending', error = NULL, updated_at = NOW()
         WHERE job_id = $1 AND id IN (${placeholders}) AND status = 'failed'
         RETURNING id`,
        [jobId, ...urlIds]
      );

      // Reset job status to processing if it was completed/failed
      await client.query(
        `UPDATE jobs 
         SET status = 'processing', updated_at = NOW()
         WHERE id = $1 AND status IN ('completed', 'failed')`,
        [jobId]
      );

      return result.rows.length;
    } finally {
      client.release();
    }
  }

  async getAllJobs(): Promise<JobRecord[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM jobs ORDER BY created_at DESC'
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}

export const database = new DatabaseService();

#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/csv_opener',
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗄️ Setting up database tables...');
    
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

    console.log('✅ Database tables created successfully!');
    console.log('📊 Tables: jobs, urls');
    console.log('🔍 Indexes: job_id, status, created_at');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();


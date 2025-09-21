import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // File handling
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  outputDir: process.env.OUTPUT_DIR || './outputs',
  
  // Job queue
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '10', 10),
  jobTimeout: parseInt(process.env.JOB_TIMEOUT || '300000', 10), // 5 minutes
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
  openaiTemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  openaiMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '100', 10),
  
  // Rate limiting
  rateLimitRequestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60', 10),
  rateLimitBurst: parseInt(process.env.RATE_LIMIT_BURST || '10', 10),
  
  // Retry configuration
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
  backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER || '2'),
};

// Validate required configuration
if (!config.openaiApiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

export default config;


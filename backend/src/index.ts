import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { redis } from './services/redis';
import { csvProcessingQueue, csvProcessingWorker } from './services/queue';
import { database } from './services/database';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { memoryMonitor } from './utils/memoryMonitor';

// Import routes
import uploadRoutes from './routes/upload';
import jobRoutes from './routes/jobs';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (exclude jobs routes as they have their own polling rate limiter)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/jobs')) {
    return next(); // Skip global rate limiter for jobs routes
  }
  return rateLimiter(req, res, next);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/jobs', jobRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Stop memory monitoring
      memoryMonitor.stopMonitoring();
      
      await csvProcessingWorker.close();
      await csvProcessingQueue.close();
      await database.cleanup();
      await redis.quit();
      logger.info('All connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = config.port;
server.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 Redis URL: ${config.redisUrl}`);
  logger.info(`🗄️ Database URL: ${config.databaseUrl}`);
  logger.info(`🤖 OpenAI Dummy Mode: ${process.env.OPENAI_DUMMY_MODE === 'true' || !process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
  
  // Start memory monitoring
  memoryMonitor.startMonitoring(30000); // Check every 30 seconds
  logger.info(`🧠 Memory monitoring started (limit: ${config.memoryLimitMB}MB)`);
});

export default app;
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redisUrl, {
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Test connection
redis.ping()
  .then(() => {
    logger.info('Redis ping successful');
  })
  .catch((error) => {
    logger.error('Redis ping failed:', error);
  });

export default redis;


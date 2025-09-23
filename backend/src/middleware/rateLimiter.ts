import rateLimit from 'express-rate-limit';
import { config } from '../config';

// General rate limiter for most endpoints
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More lenient rate limiter for polling endpoints
export const pollingRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per minute (1 per second)
  message: {
    error: 'Too many polling requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests to avoid penalizing normal polling
  skipSuccessfulRequests: true,
});

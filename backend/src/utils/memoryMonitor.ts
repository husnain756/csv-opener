import { logger } from './logger';
import { config } from '../config';

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    logger.info('Memory monitoring started');
  }

  stopMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Memory monitoring stopped');
  }

  checkMemoryUsage(): void {
    const used = process.memoryUsage();
    const memoryUsageMB = Math.round(used.heapUsed / 1024 / 1024);
    const memoryLimitMB = config.memoryLimitMB;

    // Log memory usage
    logger.debug(`Memory usage: ${memoryUsageMB}MB / ${memoryLimitMB}MB`);

    // Warn if approaching limit
    if (memoryUsageMB > memoryLimitMB * 0.8) {
      logger.warn(`High memory usage: ${memoryUsageMB}MB (${Math.round((memoryUsageMB / memoryLimitMB) * 100)}% of limit)`);
    }

    // Critical if over limit
    if (memoryUsageMB > memoryLimitMB) {
      logger.error(`Memory limit exceeded: ${memoryUsageMB}MB > ${memoryLimitMB}MB`);
      this.triggerGarbageCollection();
    }
  }

  getCurrentMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    usageMB: number;
    limitMB: number;
    percentage: number;
  } {
    const used = process.memoryUsage();
    const usageMB = Math.round(used.heapUsed / 1024 / 1024);
    const limitMB = config.memoryLimitMB;
    const percentage = Math.round((usageMB / limitMB) * 100);

    return {
      heapUsed: used.heapUsed,
      heapTotal: used.heapTotal,
      external: used.external,
      rss: used.rss,
      usageMB,
      limitMB,
      percentage
    };
  }

  private triggerGarbageCollection(): void {
    if (global.gc) {
      logger.info('Triggering garbage collection');
      global.gc();
    } else {
      logger.warn('Garbage collection not available. Start Node.js with --expose-gc flag');
    }
  }

  // Check if we can safely process a file of given size
  canProcessFile(estimatedRows: number): { canProcess: boolean; reason?: string } {
    const currentMemory = this.getCurrentMemoryUsage();
    const estimatedMemoryMB = Math.round(estimatedRows * 0.01); // Rough estimate: 0.01MB per row
    const totalMemoryMB = currentMemory.usageMB + estimatedMemoryMB;

    if (estimatedRows > config.maxRowsPerJob) {
      return {
        canProcess: false,
        reason: `File has ${estimatedRows} rows, but maximum allowed is ${config.maxRowsPerJob}`
      };
    }

    if (totalMemoryMB > config.memoryLimitMB) {
      return {
        canProcess: false,
        reason: `Processing would use ${totalMemoryMB}MB, exceeding limit of ${config.memoryLimitMB}MB`
      };
    }

    return { canProcess: true };
  }
}

export const memoryMonitor = MemoryMonitor.getInstance();

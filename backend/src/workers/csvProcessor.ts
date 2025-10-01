import { AIServiceFactory } from '../services/aiServiceFactory';
import { logger } from '../utils/logger';

export interface ProcessedRow {
  original: any;
  processed: any;
  success: boolean;
  error?: string;
}

export const processCsvRow = async (row: any, jobId: string): Promise<ProcessedRow> => {
  try {
    logger.info(`Processing row for job ${jobId}:`, row);
    
          const aiService = AIServiceFactory.getService();
          // Process the row using AI service (OpenAI or Hugging Face)
          const processed = await aiService.generateOpenerWithRetry(row.url, 'company');
    
    return {
      original: row,
      processed,
      success: true
    };
  } catch (error) {
    logger.error(`Error processing row for job ${jobId}:`, error);
    
    return {
      original: row,
      processed: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

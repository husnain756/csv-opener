import { OpenAIService } from '../services/openaiService';
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
    
    const openaiService = new OpenAIService();
    // Process the row using OpenAI service
    const processed = await openaiService.generateOpener(row.url, 'company');
    
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

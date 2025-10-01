import { OpenAIService } from './openaiService';
import { HuggingFaceService } from './huggingFaceService';
import { logger } from '../utils/logger';

export type AIServiceType = 'openai' | 'huggingface';

export interface AIService {
  generateOpenerWithRetry(
    url: string, 
    contentType: 'company' | 'person' | 'news', 
    maxRetries?: number
  ): Promise<string>;
}

export class AIServiceFactory {
  private static instance: AIService | null = null;
  private static currentType: AIServiceType | null = null;

  /**
   * Get the configured AI service instance
   */
  static getService(): AIService {
    const serviceType = this.getConfiguredServiceType();
    
    // Return cached instance if it's the same type
    if (this.instance && this.currentType === serviceType) {
      return this.instance;
    }

    // Create new instance based on configuration
    this.currentType = serviceType;
    
    switch (serviceType) {
      case 'openai':
        this.instance = new OpenAIService();
        logger.info('🤖 AI Service Factory: Using OpenAI Service');
        break;
      case 'huggingface':
        this.instance = new HuggingFaceService();
        logger.info('🤗 AI Service Factory: Using Hugging Face Service');
        break;
      default:
        throw new Error(`Unsupported AI service type: ${serviceType}`);
    }

    return this.instance!;
  }

  /**
   * Get the currently configured service type
   */
  static getConfiguredServiceType(): AIServiceType {
    const configuredType = process.env.AI_SERVICE_TYPE?.toLowerCase() as AIServiceType;
    
    // If explicitly configured, use that service regardless of dummy mode
    if (configuredType && ['openai', 'huggingface'].includes(configuredType)) {
      logger.info(`🤖 AI Service Factory: Using explicitly configured service: ${configuredType}`);
      return configuredType;
    }

    // Auto-detect based on available API keys and dummy modes
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasHuggingFaceKey = !!process.env.HUGGINGFACE_API_KEY;
    const openaiDummyMode = process.env.OPENAI_DUMMY_MODE === 'true';
    const huggingfaceDummyMode = process.env.HUGGINGFACE_DUMMY_MODE === 'true';

    // Priority: OpenAI if available and not in dummy mode
    if (hasOpenAIKey && !openaiDummyMode) {
      logger.info('🤖 AI Service Factory: Auto-detected OpenAI (has API key, not in dummy mode)');
      return 'openai';
    }

    // Fallback: Hugging Face if available and not in dummy mode
    if (hasHuggingFaceKey && !huggingfaceDummyMode) {
      logger.info('🤗 AI Service Factory: Auto-detected Hugging Face (has API key, not in dummy mode)');
      return 'huggingface';
    }

    // Fallback: OpenAI dummy mode
    if (hasOpenAIKey || openaiDummyMode) {
      logger.info('🤖 AI Service Factory: Auto-detected OpenAI (fallback to dummy mode)');
      return 'openai';
    }

    // Final fallback: Hugging Face dummy mode
    logger.info('🤗 AI Service Factory: Auto-detected Hugging Face (fallback to dummy mode)');
    return 'huggingface';
  }

  /**
   * Force refresh the service instance (useful for testing or config changes)
   */
  static refreshService(): AIService {
    this.instance = null;
    this.currentType = null;
    return this.getService();
  }

  /**
   * Get service status information
   */
  static getServiceStatus(): {
    currentType: AIServiceType;
    configuredType: AIServiceType | null;
    openaiAvailable: boolean;
    huggingfaceAvailable: boolean;
    openaiDummyMode: boolean;
    huggingfaceDummyMode: boolean;
  } {
    const configuredType = process.env.AI_SERVICE_TYPE?.toLowerCase() as AIServiceType;
    const currentType = this.getConfiguredServiceType();
    
    return {
      currentType,
      configuredType: configuredType && ['openai', 'huggingface'].includes(configuredType) ? configuredType : null,
      openaiAvailable: !!process.env.OPENAI_API_KEY,
      huggingfaceAvailable: !!process.env.HUGGINGFACE_API_KEY,
      openaiDummyMode: process.env.OPENAI_DUMMY_MODE === 'true',
      huggingfaceDummyMode: process.env.HUGGINGFACE_DUMMY_MODE === 'true',
    };
  }
}

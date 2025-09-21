import OpenAI from 'openai';
import { formatPrompt, getPromptTemplate } from '../utils/prompts';
import { ContentType, OpenAIResponse } from '../types';

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '100');
  }

  async generateOpener(url: string, contentType: ContentType): Promise<OpenAIResponse> {
    try {
      const template = getPromptTemplate(contentType);
      const { system, user } = formatPrompt(template, url);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const opener = response.choices[0]?.message?.content?.trim() || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        opener,
        tokensUsed
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate opener: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateOpenerWithRetry(
    url: string, 
    contentType: ContentType, 
    maxRetries: number = 3
  ): Promise<OpenAIResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateOpener(url, contentType);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain errors
        if (error instanceof Error && (
          error.message.includes('Invalid API key') ||
          error.message.includes('insufficient_quota') ||
          error.message.includes('billing')
        )) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying OpenAI request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}


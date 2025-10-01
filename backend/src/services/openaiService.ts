import OpenAI from 'openai';
import { formatPrompt, getPromptTemplate } from '../utils/prompts';
import { ContentType, OpenAIResponse } from '../types';

export class OpenAIService {
  private client?: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private dummyMode: boolean;

  constructor() {
    this.dummyMode = process.env.OPENAI_DUMMY_MODE === 'true' || !process.env.OPENAI_API_KEY;
    
    // Log the mode being used
    if (this.dummyMode) {
      console.log('🤖 OpenAI Service: DUMMY MODE ENABLED - Using fake responses');
      console.log('🤖 OpenAI Service: Dummy mode reason:', !process.env.OPENAI_API_KEY ? 'No API key provided' : 'Dummy mode explicitly enabled');
    } else {
      console.log('🤖 OpenAI Service: REAL API MODE ENABLED - Using OpenAI API');
      console.log('🤖 OpenAI Service: API Key present:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
    }
    
    if (!this.dummyMode) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '100');
    
    console.log('🤖 OpenAI Service: Model:', this.model, 'Temperature:', this.temperature, 'Max Tokens:', this.maxTokens);
  }

  async generateOpener(url: string, contentType: ContentType): Promise<OpenAIResponse> {
    // Dummy mode for local development
    if (this.dummyMode) {
      console.log('🤖 OpenAI Service: Generating DUMMY opener for URL:', url);
      return this.generateDummyOpener(url, contentType);
    }

    try {
      console.log('🤖 OpenAI Service: Making REAL OpenAI API call for URL:', url);
      const template = getPromptTemplate(contentType);
      const { system, user } = formatPrompt(template, url);

      console.log('🤖 OpenAI Service: System prompt:', system);
      console.log('🤖 OpenAI Service: User prompt:', user);

      const response = await this.client!.chat.completions.create({
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

      console.log('🤖 OpenAI Service: API Response - Tokens used:', tokensUsed);
      console.log('🤖 OpenAI Service: Generated opener:', opener);

      return {
        opener,
        tokensUsed
      };
    } catch (error) {
      console.error('🤖 OpenAI Service: API error:', error);
      throw new Error(`Failed to generate opener: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateDummyOpener(url: string, contentType: ContentType): Promise<OpenAIResponse> {
    console.log('🤖 OpenAI Service: Simulating API delay for dummy response...');
    // Simulate API delay (2-3 seconds)
    const delay = Math.random() * 1000 + 2000; // 2-3 seconds
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate dummy opener based on content type
    const dummyOpeners = {
      company: [
        `Hi there! I came across ${url} and was impressed by your company's innovative approach to solving complex problems. I'd love to learn more about your services and see if there might be a way for us to collaborate.`,
        `Hello! I've been following ${url} and I'm really impressed with the work your team is doing. I think there could be some interesting opportunities for partnership between our organizations.`,
        `Hi! I discovered ${url} through a colleague and was really impressed by your company's mission and values. I'd love to explore potential collaboration opportunities.`
      ],
      person: [
        `Hi! I came across your profile and was really impressed by your background in the industry. I'd love to connect and learn more about your experience.`,
        `Hello! I noticed your work and thought it would be great to connect. I'm always interested in meeting other professionals in our field.`,
        `Hi there! I saw your profile and was impressed by your expertise. I'd love to connect and potentially collaborate on future projects.`
      ],
      news: [
        `Hi! I read the recent news about your company and was really impressed by the developments. I'd love to learn more about what you're working on.`,
        `Hello! I came across the recent coverage of your work and found it fascinating. I'd be interested in learning more about your current projects.`,
        `Hi there! I saw the recent news about your company and was really impressed. I'd love to connect and discuss potential opportunities.`
      ]
    };

    const openers = dummyOpeners[contentType];
    const randomOpener = openers[Math.floor(Math.random() * openers.length)];

    console.log('🤖 OpenAI Service: Generated DUMMY opener:', randomOpener);

    return {
      opener: randomOpener,
      tokensUsed: Math.floor(Math.random() * 50) + 20 // Random token count
    };
  }

  async generateOpenerWithRetry(
    url: string, 
    contentType: ContentType, 
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.generateOpener(url, contentType);
        return response.opener;
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


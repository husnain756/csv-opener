import { logger } from '../utils/logger';
import { PROMPT_TEMPLATES } from '../utils/prompts';

export class HuggingFaceService {
  private apiKey: string | null;
  private baseUrl: string;
  private model: string;
  private dummyMode: boolean;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || null;
    this.baseUrl = 'https://api-inference.huggingface.co/models';
    this.model = 'distilgpt2'; // Smaller, faster GPT-2 model
    this.dummyMode = process.env.HUGGINGFACE_DUMMY_MODE === 'true' || !this.apiKey;

    if (this.dummyMode) {
      console.log('🤗 Hugging Face Service: DUMMY MODE ENABLED - Using fake responses');
      console.log('🤗 Hugging Face Service: Dummy mode reason:', !process.env.HUGGINGFACE_API_KEY ? 'No API key provided' : 'Dummy mode explicitly enabled');
    } else {
      console.log('🤗 Hugging Face Service: REAL API MODE ENABLED - Using Hugging Face API');
      console.log('🤗 Hugging Face Service: API Key present:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
      console.log('🤗 Hugging Face Service: Using model:', this.model);
    }
  }

  async generateOpenerWithRetry(
    url: string, 
    contentType: 'company' | 'person' | 'news', 
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateOpener(url, contentType);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt}/${maxRetries} failed for URL ${url}:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, throw the last error
    throw lastError || new Error('All retry attempts failed');
  }

  async generateOpener(url: string, contentType: 'company' | 'person' | 'news'): Promise<string> {
    try {
      if (this.dummyMode) {
        console.log('🤗 Hugging Face Service: Generating DUMMY opener for URL:', url);
        return this.generateDummyOpener(url, contentType);
      }

      console.log('🤗 Hugging Face Service: Making REAL Hugging Face API call for URL:', url);
      
      const prompt = this.formatPrompt(url, contentType);
      console.log('🤗 Hugging Face Service: Formatted prompt:', prompt);

      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: 100,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9,
            return_full_text: false,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🤗 Hugging Face Service: API Error:', response.status, errorText);
        throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🤗 Hugging Face Service: API Response:', data);

      if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
        const opener = this.cleanGeneratedText(data[0].generated_text);
        console.log('🤗 Hugging Face Service: Generated opener:', opener);
        return opener;
      } else {
        console.warn('🤗 Hugging Face Service: Unexpected response format:', data);
        return this.generateDummyOpener(url, contentType);
      }
    } catch (error) {
      logger.error('Hugging Face API error:', error);
      console.error('🤗 Hugging Face Service: Error generating opener:', error);
      
      // Fallback to dummy response on error
      return this.generateDummyOpener(url, contentType);
    }
  }

  private formatPrompt(url: string, contentType: 'company' | 'person' | 'news'): string {
    // For GPT-2, we'll use a more direct prompt format
    return `Professional business outreach message for ${url}: Hi, I noticed your company and was impressed by your work. I'd love to learn more about your approach to innovation and how you're tackling current market challenges. Would you be open to a brief conversation about potential collaboration opportunities?`;
  }

  private cleanGeneratedText(text: string): string {
    // Clean up the generated text
    return text
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes at start/end
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 200); // Limit length
  }

  private generateDummyOpener(url: string, contentType: 'company' | 'person' | 'news'): string {
    // Generate more diverse, URL-specific dummy openers
    const domain = this.extractDomain(url);
    const companyName = this.extractCompanyName(domain);
    
    const dummyOpeners = {
      company: [
        `Hi ${companyName} team! I've been following your recent growth and am impressed by your innovative approach. What's driving your success in this competitive market?`,
        `Hello! I noticed ${companyName}'s recent developments and would love to learn more about your strategy. How are you adapting to current industry challenges?`,
        `Hi there! ${companyName}'s work caught my attention. I'd be interested in understanding your approach to innovation and growth. What's been most effective for you?`,
        `Hello ${companyName}! I'm impressed by your company's trajectory. What strategies have helped you navigate the current market landscape?`,
        `Hi! I came across ${companyName} and was intrigued by your approach. How are you tackling the challenges in your industry?`,
        `Hello ${companyName}! Your company's mission and recent achievements have caught my attention. I'd love to learn more about your vision and how you're shaping the future of your industry.`,
        `Hi there! I've been following ${companyName}'s journey and am impressed by your team's dedication. What excites you most about the opportunities ahead?`,
        `Hello! ${companyName}'s innovative solutions are making waves in the industry. I'd be interested in hearing about your approach to staying ahead of the curve.`
      ],
      person: [
        `Hi! I came across your profile and was impressed by your expertise in this field. How did you get started in this area?`,
        `Hello! Your background is quite interesting. What's been the most rewarding part of your career journey?`,
        `Hi there! I noticed your recent work and found it fascinating. What inspired you to pursue this path?`,
        `Hello! Your insights on this topic are valuable. How do you see the industry evolving?`,
        `Hi! I'd love to learn more about your experience. What's been your biggest challenge and how did you overcome it?`
      ],
      news: [
        `Hi! I read about the recent developments you've been involved in. What's your perspective on the current trends?`,
        `Hello! Your recent insights were very informative. How do you see things evolving in this space?`,
        `Hi there! I found your take on the latest news quite interesting. What do you think will happen next?`,
        `Hello! I'd love to hear your thoughts on the current market situation. What trends are you watching?`,
        `Hi! Your analysis of recent events was insightful. What's your outlook for the coming months?`
      ]
    };

    const openers = dummyOpeners[contentType];
    // Use URL hash to get consistent but varied results
    const hash = this.simpleHash(url);
    const randomOpener = openers[hash % openers.length];
    
    console.log('🤗 Hugging Face Service: Generated dummy opener for', domain, ':', randomOpener);
    return randomOpener;
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url.split('/')[2] || url;
    }
  }

  private extractCompanyName(domain: string): string {
    // Extract company name from domain with better logic
    const parts = domain.split('.');
    
    // Handle subdomains and special cases
    if (parts.length > 2) {
      // For subdomains like "careers.deliveryhero.com" or "boards.greenhouse.io"
      const subdomain = parts[0];
      const mainDomain = parts[1];
      
      // Special cases for known companies
      if (mainDomain === 'deliveryhero') return 'Delivery Hero';
      if (mainDomain === 'greenhouse') return 'Zenjob';
      if (mainDomain === 'workable') return '1valet';
      if (mainDomain === 'icims') return 'Neo Financial';
      if (mainDomain === 'doctolib') return 'Doctolib';
      
      // For other subdomains, use the main domain
      return this.formatCompanyName(mainDomain);
    }
    
    // For direct domains
    if (parts.length > 1) {
      return this.formatCompanyName(parts[0]);
    }
    
    return this.formatCompanyName(domain);
  }

  private formatCompanyName(name: string): string {
    // Format company name properly
    return name
      .replace(/-/g, ' ') // Replace hyphens with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export const huggingFaceService = new HuggingFaceService();

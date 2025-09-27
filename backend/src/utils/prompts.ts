import { PromptTemplate, ContentType } from '../types';

export const PROMPT_TEMPLATES: Record<ContentType, PromptTemplate> = {
  company: {
    system: "You are a professional outreach assistant. Generate tasteful, non-salesy openers for business outreach.",
    user: `Given this URL, write a professional 1-2 sentence opener for business outreach. Requirements:
- Maximum 40 words
- Show genuine interest without being salesy
- Be specific to the URL context
- Ask a question or invite conversation
- Professional, respectful tone

URL: {url}

Generate only the opener text, no additional commentary.`
  },
  person: {
    system: "You are a professional networking assistant. Generate respectful, personalized LinkedIn message openers.",
    user: `Given this URL, write a professional 1-2 sentence opener for LinkedIn networking. Requirements:
- Maximum 40 words
- Show genuine interest without being salesy
- Be specific to the URL context
- Ask a question or invite conversation
- Professional, respectful tone
- Don't invent personal information

URL: {url}

Generate only the opener text, no additional commentary.`
  },
  news: {
    system: "You are writing short summaries and openers for community/news content.",
    user: `Given this URL, write a professional 1-2 sentence opener for news/community content. Requirements:
- Maximum 40 words
- Show genuine interest without being salesy
- Be specific to the URL context
- Ask a question or invite conversation
- Professional, respectful tone
- Keep it factual

URL: {url}

Generate only the opener text, no additional commentary.`
  }
};

export function getPromptTemplate(contentType: ContentType): PromptTemplate {
  return PROMPT_TEMPLATES[contentType];
}

export function formatPrompt(template: PromptTemplate, url: string): { system: string; user: string } {
  return {
    system: template.system,
    user: template.user.replace('{url}', url)
  };
}


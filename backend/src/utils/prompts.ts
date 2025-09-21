import { PromptTemplate, ContentType } from '../types';

export const PROMPT_TEMPLATES: Record<ContentType, PromptTemplate> = {
  company: {
    system: "You are a professional outreach assistant. Generate tasteful, non-salesy openers for business outreach.",
    user: `You are a professional outreach assistant. Given only this URL, write a tasteful, non-salesy 1–2 sentence opener suitable for a first outreach message. Maximum 40 words. Tone: professional, helpful.

URL: {url}

Generate only the opener text, no additional commentary.`
  },
  person: {
    system: "You are a professional networking assistant. Generate respectful, personalized LinkedIn message openers.",
    user: `You are a professional networking assistant. Based on the URL context below, write a concise (≤40 words) opener to start a LinkedIn message. Keep it respectful and personalized; do not invent sensitive personal info.

URL: {url}

Generate only the opener text, no additional commentary.`
  },
  news: {
    system: "You are writing short summaries and openers for community/news content.",
    user: `You are writing a short 1–2 sentence summary/opener for a community/news page. Keep it factual and under 40 words.

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


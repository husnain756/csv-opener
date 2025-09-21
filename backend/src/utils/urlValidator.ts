export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrl(urlString: string): string {
  // Remove whitespace
  urlString = urlString.trim();
  
  // If no protocol, add https://
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    urlString = 'https://' + urlString;
  }
  
  return urlString;
}

export function validateAndNormalizeUrl(urlString: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  if (!urlString || typeof urlString !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  const trimmed = urlString.trim();
  if (!trimmed) {
    return { isValid: false, error: 'URL cannot be empty' };
  }

  try {
    const normalized = normalizeUrl(trimmed);
    
    if (isValidUrl(normalized)) {
      return { isValid: true, normalizedUrl: normalized };
    } else {
      return { isValid: false, error: 'Invalid URL format' };
    }
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

export function extractUrlContext(url: string): {
  domain: string;
  path: string;
  isLinkedIn: boolean;
  isCompany: boolean;
} {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname;
    
    const isLinkedIn = domain.includes('linkedin.com');
    const isCompany = !isLinkedIn && !domain.includes('news') && !domain.includes('blog');
    
    return {
      domain,
      path,
      isLinkedIn,
      isCompany
    };
  } catch {
    return {
      domain: '',
      path: '',
      isLinkedIn: false,
      isCompany: false
    };
  }
}


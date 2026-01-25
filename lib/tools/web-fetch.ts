import type { ToolResult } from '@/lib/schemas';

const FETCH_TIMEOUT = 15000;
const MAX_CONTENT_LENGTH = 50000;

export async function webFetch(url: string): Promise<ToolResult> {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { type: 'error', error: 'Only HTTP(S) URLs are supported' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { type: 'error', error: `Fetch failed: ${response.status} ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';

    // Only process HTML and text content
    if (!contentType.includes('text/') && !contentType.includes('application/json')) {
      return { type: 'error', error: `Unsupported content type: ${contentType}` };
    }

    let content = await response.text();

    // Extract title if HTML
    let title: string | undefined;
    if (contentType.includes('text/html')) {
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : undefined;

      // Convert HTML to plain text
      content = htmlToText(content);
    }

    // Truncate if too long
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
    }

    return {
      type: 'web_fetch',
      result: {
        url,
        content,
        title,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { type: 'error', error: 'Fetch timed out' };
    }
    const message = error instanceof Error ? error.message : 'Unknown fetch error';
    return { type: 'error', error: message };
  }
}

function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert common block elements to newlines
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|article|section|header|footer)[^>]*>/gi, '\n')
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, '\n\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  return text;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

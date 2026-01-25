import type { ToolResult, WebSearchResult } from '@/lib/schemas';

const SEARCH_TIMEOUT = 10000;

export async function webSearch(query: string): Promise<ToolResult> {
  try {
    // Use DuckDuckGo HTML search (no API key required)
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const results = parseSearchResults(html);

    return {
      type: 'web_search',
      results: results.slice(0, 5), // Limit to top 5 results
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { type: 'error', error: 'Search timed out' };
    }
    const message = error instanceof Error ? error.message : 'Unknown search error';
    return { type: 'error', error: message };
  }
}

function parseSearchResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // Match result blocks - DuckDuckGo uses class="result"
  const resultRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*)<\/a>/gi;

  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const [, url, title, snippet] = match;
    if (url && title) {
      // DuckDuckGo uses redirect URLs, extract the actual URL
      const actualUrl = extractActualUrl(url);
      results.push({
        url: actualUrl,
        title: decodeHtmlEntities(title.trim()),
        snippet: decodeHtmlEntities(snippet?.trim() || ''),
      });
    }
  }

  // Fallback: simpler parsing if the above doesn't match
  if (results.length === 0) {
    const simpleLinkRegex = /<a[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
    while ((match = simpleLinkRegex.exec(html)) !== null) {
      const [, url, title] = match;
      if (url && title && !url.includes('duckduckgo.com')) {
        results.push({
          url: extractActualUrl(url),
          title: decodeHtmlEntities(title.trim()),
          snippet: '',
        });
      }
    }
  }

  return results;
}

function extractActualUrl(ddgUrl: string): string {
  // DuckDuckGo wraps URLs in redirects like //duckduckgo.com/l/?uddg=ENCODED_URL
  try {
    if (ddgUrl.includes('uddg=')) {
      const match = ddgUrl.match(/uddg=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    // If it's already a direct URL
    if (ddgUrl.startsWith('http')) {
      return ddgUrl;
    }
    if (ddgUrl.startsWith('//')) {
      return 'https:' + ddgUrl;
    }
    return ddgUrl;
  } catch {
    return ddgUrl;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

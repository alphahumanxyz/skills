// Notion Search API
import type { SearchResponse } from '@notionhq/client/build/src/api-endpoints';

// Resolve notionFetch from globalThis at call time (esbuild IIFE breaks module imports)
function apiFetch<T>(endpoint: string, options?: { method?: string; body?: unknown }): T {
  const g = globalThis as unknown as Record<string, unknown>;
  const e = g.exports as Record<string, unknown> | undefined;
  const fn = (e?.notionFetch ?? g.notionFetch) as
    | ((ep: string, opts?: { method?: string; body?: unknown }) => unknown)
    | undefined;
  if (!fn) throw new Error('[notion] notionFetch not available');
  return fn(endpoint, options) as T;
}

export function search(body: Record<string, unknown>): SearchResponse {
  return apiFetch<SearchResponse>('/search', { method: 'POST', body });
}

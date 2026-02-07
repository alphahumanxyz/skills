// Notion Search API
import type { SearchResponse } from '@notionhq/client/build/src/api-endpoints';

import { apiFetch } from './client';

export function search(body: Record<string, unknown>): SearchResponse {
  return apiFetch<SearchResponse>('/search', { method: 'POST', body });
}

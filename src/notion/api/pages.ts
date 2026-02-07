// Notion Pages API
import type {
  CreatePageResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  UpdatePageResponse,
} from '@notionhq/client/build/src/api-endpoints';

// Resolve notionFetch from globalThis at call time.
// esbuild IIFE bundling breaks inter-module imports (the SKILL_HEADER's
// `var exports = {}` shadows per-module export objects), so we cannot
// `import { apiFetch } from './client'` — the reference would be undefined
// at runtime.  Instead each api file carries its own tiny resolver.
function apiFetch<T>(endpoint: string, options?: { method?: string; body?: unknown }): T {
  const g = globalThis as unknown as Record<string, unknown>;
  const e = g.exports as Record<string, unknown> | undefined;
  const fn = (e?.notionFetch ?? g.notionFetch) as
    | ((ep: string, opts?: { method?: string; body?: unknown }) => unknown)
    | undefined;
  if (!fn) throw new Error('[notion] notionFetch not available');
  return fn(endpoint, options) as T;
}

export function getPage(pageId: string): GetPageResponse {
  return apiFetch<GetPageResponse>(`/pages/${pageId}`);
}

export function createPage(body: Record<string, unknown>): CreatePageResponse {
  return apiFetch<CreatePageResponse>('/pages', { method: 'POST', body });
}

export function updatePage(pageId: string, body: Record<string, unknown>): UpdatePageResponse {
  return apiFetch<UpdatePageResponse>(`/pages/${pageId}`, { method: 'PATCH', body });
}

export function archivePage(pageId: string): UpdatePageResponse {
  return apiFetch<UpdatePageResponse>(`/pages/${pageId}`, {
    method: 'PATCH',
    body: { archived: true },
  });
}

export function getPageContent(pageId: string, pageSize: number = 50): ListBlockChildrenResponse {
  return apiFetch<ListBlockChildrenResponse>(`/blocks/${pageId}/children?page_size=${pageSize}`);
}

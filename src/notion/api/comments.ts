// Notion Comments API
import type {
  CreateCommentResponse,
  ListCommentsResponse,
} from '@notionhq/client/build/src/api-endpoints';

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

export function createComment(body: Record<string, unknown>): CreateCommentResponse {
  return apiFetch<CreateCommentResponse>('/comments', { method: 'POST', body });
}

export function listComments(blockId: string, pageSize: number = 20): ListCommentsResponse {
  return apiFetch<ListCommentsResponse>(`/comments?block_id=${blockId}&page_size=${pageSize}`);
}

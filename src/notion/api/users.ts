// Notion Users API
import type { GetUserResponse, ListUsersResponse } from '@notionhq/client/build/src/api-endpoints';

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

export function getUser(userId: string): GetUserResponse {
  return apiFetch<GetUserResponse>(`/users/${userId}`);
}

export function listUsers(pageSize: number = 20, startCursor?: string): ListUsersResponse {
  let endpoint = `/users?page_size=${pageSize}`;
  if (startCursor) endpoint += `&start_cursor=${startCursor}`;
  return apiFetch<ListUsersResponse>(endpoint);
}

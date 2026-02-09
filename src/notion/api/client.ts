// Centralized Notion API fetch resolver.
// Resolves `notionFetch` from globalThis at call time (same dual-location
// check as the `n()` pattern in types.ts), and returns a typed wrapper.

import { notionFetch } from "../helpers";


export function apiFetch<T>(endpoint: string, options?: { method?: string; body?: unknown }): T {
  return notionFetch(endpoint, options) as T;
}

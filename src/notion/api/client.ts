// Centralized Notion API fetch resolver.
// Resolves `notionFetch` from globalThis at call time (same dual-location
// check as the `n()` pattern in types.ts), and returns a typed wrapper.

type NotionFetchFn = (endpoint: string, options?: { method?: string; body?: unknown }) => unknown;

function resolveNotionFetch(): NotionFetchFn {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.exports && typeof (g.exports as Record<string, unknown>).notionFetch === 'function') {
    return (g.exports as Record<string, unknown>).notionFetch as NotionFetchFn;
  }
  if (typeof g.notionFetch === 'function') {
    return g.notionFetch as NotionFetchFn;
  }
  throw new Error('notionFetch is not available — ensure the Notion skill is initialized');
}

export function apiFetch<T>(endpoint: string, options?: { method?: string; body?: unknown }): T {
  return resolveNotionFetch()(endpoint, options) as T;
}

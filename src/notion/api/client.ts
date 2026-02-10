// Centralized Notion API fetch resolver.
import { notionFetch } from '../helpers';

export async function apiFetch<T>(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  return await notionFetch<T>(endpoint, options);
}

// Notion Databases API
import type {
  CreateDatabaseResponse,
  GetDatabaseResponse,
  GetDataSourceResponse,
  QueryDataSourceResponse,
  SearchResponse,
  UpdateDatabaseResponse,
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

export function getDatabase(databaseId: string): GetDatabaseResponse {
  return apiFetch<GetDatabaseResponse>(`/databases/${databaseId}`);
}

/**
 * Resolve a database container ID to its first data_source ID.
 * This is needed because the Notion API 2025-09-03 uses data_sources
 * for queries and schema access. Throws if no data sources exist.
 */
export function resolveDataSourceId(databaseId: string): string {
  const dbContainer = getDatabase(databaseId) as unknown as {
    data_sources?: Array<{ id: string }>;
  };
  const dataSources = dbContainer?.data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error('Database has no data sources. Share the database with your integration.');
  }
  return dataSources[0].id;
}

export function getDataSource(dataSourceId: string): GetDataSourceResponse {
  return apiFetch<GetDataSourceResponse>(`/data_sources/${dataSourceId}`);
}

/**
 * Query a database. Resolves the data_source_id internally.
 * If the given ID is already a data_source ID (e.g. from search results),
 * it queries directly instead of trying to resolve via /databases/.
 */
export function queryDataSource(
  databaseId: string,
  body?: Record<string, unknown>
): QueryDataSourceResponse {
  let dataSourceId: string;
  try {
    dataSourceId = resolveDataSourceId(databaseId);
  } catch {
    // The ID may already be a data_source ID (search returns data_source objects
    // whose IDs are stored directly). Use it as-is.
    dataSourceId = databaseId;
  }
  return apiFetch<QueryDataSourceResponse>(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: body || {},
  });
}

export function createDatabase(body: Record<string, unknown>): CreateDatabaseResponse {
  return apiFetch<CreateDatabaseResponse>('/databases', { method: 'POST', body });
}

export function updateDatabase(
  databaseId: string,
  body: Record<string, unknown>
): UpdateDatabaseResponse {
  return apiFetch<UpdateDatabaseResponse>(`/databases/${databaseId}`, { method: 'PATCH', body });
}

export function listAllDatabases(pageSize: number = 20): SearchResponse {
  return apiFetch<SearchResponse>('/search', {
    method: 'POST',
    body: { filter: { property: 'object', value: 'data_source' }, page_size: pageSize },
  });
}

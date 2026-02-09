// Notion sync engine
// Periodically downloads pages, databases, users, and page content from Notion
// into local SQLite for fast local querying.
import type { NotionApi } from './api/index';
import './skill-state';
import type { NotionGlobals } from './types';

// Resolve helpers and API from globalThis at call time.
// We avoid module imports of n()/getApi() because esbuild's IIFE bundling
// can fail to resolve peer-module exports in sync.ts (tools/ works fine
// because they're in a subdirectory). Resolving from globalThis is reliable.
const n = (): NotionGlobals => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.exports && typeof (g.exports as Record<string, unknown>).notionFetch === 'function') {
    return g.exports as unknown as NotionGlobals;
  }
  return globalThis as unknown as NotionGlobals;
};

const getApi = (): NotionApi => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.exports && typeof (g.exports as Record<string, unknown>).notionApi === 'object') {
    return (g.exports as Record<string, unknown>).notionApi as NotionApi;
  }
  return g.notionApi as NotionApi;
};

// ---------------------------------------------------------------------------
// Main sync orchestrator
// ---------------------------------------------------------------------------

export function performSync(): void {
  const s = globalThis.getNotionSkillState();

  // Guard: skip if already syncing or no credential
  if (s.syncStatus.syncInProgress) {
    console.log('[notion] Sync already in progress, skipping');
    return;
  }

  if (!oauth.getCredential()) {
    console.log('[notion] No credential, skipping sync');
    return;
  }

  const startTime = Date.now();
  s.syncStatus.syncInProgress = true;
  s.syncStatus.lastSyncError = null;
  publishSyncState();

  try {
    // Phase 1: Sync users
    console.log('[notion] Sync phase 1: users');
    syncUsers();

    // Phase 2: Sync pages and databases via search
    console.log('[notion] Sync phase 2: pages & databases');
    syncSearchItems();

    // Phase 2.5: Sync database rows
    console.log('[notion] Sync phase 2.5: database rows');
    syncDatabaseRows();

    // Phase 3: Sync page content (block text)
    if (s.config.contentSyncEnabled) {
      console.log('[notion] Sync phase 3: page content');
      syncContent();
    }

    // Phase 4: Sync unsynced summaries to the server
    console.log('[notion] Sync phase 4: sync summaries to server');
    syncSummariesToServer();

    // Update sync state
    const durationMs = Date.now() - startTime;
    const nowMs = Date.now();
    s.syncStatus.nextSyncTime = nowMs + s.config.syncIntervalMinutes * 60 * 1000;
    s.syncStatus.lastSyncDurationMs = durationMs;

    // Persist sync time in database
    const { getEntityCounts } = n();

    // Only advance lastSyncTime if we actually have items in the DB.
    // This prevents the incremental sync from skipping everything on the
    // next run if the first sync stored 0 items (e.g. due to errors).
    const counts = getEntityCounts();
    if (counts.pages > 0 || counts.databases > 0) {
      s.syncStatus.lastSyncTime = nowMs;
    }

    // Update counts
    s.syncStatus.totalPages = counts.pages;
    s.syncStatus.totalDatabases = counts.databases;
    s.syncStatus.totalUsers = counts.users;
    s.syncStatus.pagesWithContent = counts.pagesWithContent;
    s.syncStatus.pagesWithSummary = counts.pagesWithSummary;
    s.syncStatus.summariesTotal = counts.summariesTotal;
    s.syncStatus.summariesPending = counts.summariesPending;

    s.syncStatus.totalDatabaseRows = counts.databaseRows;

    console.log(
      `[notion] Sync complete in ${durationMs}ms — ${counts.pages} pages, ${counts.databases} databases, ${counts.databaseRows} db rows, ${counts.users} users`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    s.syncStatus.lastSyncError = errorMsg;
    s.syncStatus.lastSyncDurationMs = Date.now() - startTime;
    console.error(`[notion] Sync failed: ${errorMsg}`);
  } finally {
    s.syncStatus.syncInProgress = false;
    publishSyncState();
  }
}

// ---------------------------------------------------------------------------
// Phase 1: Sync users
// ---------------------------------------------------------------------------

function syncUsers(): void {
  const upsertUser = (globalThis as Record<string, unknown>).upsertUser as
    | ((user: Record<string, unknown>) => void)
    | undefined;
  if (!upsertUser) {
    console.warn('[notion] upsertUser not available on globalThis — skipping user sync');
    return;
  }

  let startCursor: string | undefined;
  let hasMore = true;
  let count = 0;

  // Collect all user records for emitting after sync
  const allUsers: Array<Record<string, unknown>> = [];

  while (hasMore) {
    const result = getApi().listUsers(100, startCursor);

    for (const user of result.results) {
      try {
        upsertUser(user as Record<string, unknown>);
        allUsers.push(user as Record<string, unknown>);
        count++;
      } catch (e) {
        console.error(
          `[notion] Failed to upsert user ${(user as Record<string, unknown>).id}: ${e}`
        );
      }
    }

    hasMore = result.has_more;
    startCursor = (result.next_cursor as string | undefined) || undefined;
  }

  // Emit user data to frontend with all relevant fields
  if (allUsers.length > 0) {
    const usersPayload = allUsers.map(u => {
      const person = u.person as Record<string, unknown> | undefined;
      const bot = u.bot as Record<string, unknown> | undefined;
      return {
        id: u.id as string,
        name: (u.name as string) || '(Unknown)',
        type: (u.type as string) || 'person',
        email: (person?.email as string) || null,
        avatarUrl: (u.avatar_url as string) || null,
        // Bot-specific fields
        botOwnerType: bot ? ((bot.owner as Record<string, unknown>)?.type as string) || null : null,
        botWorkspaceId: bot
          ? ((bot.owner as Record<string, unknown>)?.workspace as boolean)
            ? 'workspace'
            : null
          : null,
      };
    });
    state.set('users', usersPayload);
  }

  console.log(`[notion] Synced ${count} users`);
}

// ---------------------------------------------------------------------------
// Phase 2: Sync pages and databases via search (incremental)
// Restricts to items updated in the last 30 days to limit data volume.
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function syncSearchItems(): void {
  const api = getApi();
  const upsertPage = (globalThis as Record<string, unknown>).upsertPage as
    | ((page: Record<string, unknown>) => void)
    | undefined;
  const upsertDatabase = (globalThis as Record<string, unknown>).upsertDatabase as
    | ((database: Record<string, unknown>) => void)
    | undefined;
  const getPageById = (globalThis as Record<string, unknown>).getPageById as
    | ((id: string) => { last_edited_time: string } | null)
    | undefined;
  const getDatabaseById = (globalThis as Record<string, unknown>).getDatabaseById as
    | ((id: string) => { last_edited_time: string } | null)
    | undefined;

  if (!upsertPage || !upsertDatabase) {
    console.warn(
      '[notion] upsertPage/upsertDatabase not available on globalThis — skipping search sync'
    );
    return;
  }

  const s = globalThis.getNotionSkillState();
  const lastSyncTime = s.syncStatus.lastSyncTime;
  const isFirstSync = lastSyncTime === 0;
  const cutoffMs = Date.now() - THIRTY_DAYS_MS;

  let startCursor: string | undefined;
  let hasMore = true;
  let pageCount = 0;
  let dbCount = 0;
  let pageSkipped = 0;
  let dbSkipped = 0;
  let errorCount = 0;
  let reachedOldItems = false;

  while (hasMore && !reachedOldItems) {
    const body: Record<string, unknown> = {
      page_size: 100,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
    };
    if (startCursor) body.start_cursor = startCursor;

    const result = api.search(body);

    for (const item of result.results) {
      const rec = item as Record<string, unknown>;
      const lastEdited = rec.last_edited_time as string;
      if (!lastEdited) continue; // Skip partial objects without timestamps

      const editedMs = new Date(lastEdited).getTime();

      // Restrict to items updated in the last 30 days
      if (editedMs < cutoffMs) {
        reachedOldItems = true;
        break;
      }

      // Incremental: stop when we reach items older than last sync
      if (!isFirstSync && editedMs <= lastSyncTime) {
        reachedOldItems = true;
        break;
      }

      const objectType = rec.object as string;

      if (objectType === 'page') {
        const existing = getPageById?.(rec.id as string);
        if (existing && existing.last_edited_time === lastEdited) {
          pageSkipped++;
        } else {
          try {
            upsertPage(rec);
            pageCount++;
          } catch (e) {
            console.error(`[notion] Failed to upsert page ${rec.id}: ${e}`);
            errorCount++;
          }
        }
      } else if (objectType === 'data_source' || objectType === 'database') {
        const existing = getDatabaseById?.(rec.id as string);
        if (existing && existing.last_edited_time === lastEdited) {
          dbSkipped++;
        } else {
          try {
            upsertDatabase(rec);
            dbCount++;
          } catch (e) {
            console.error(`[notion] Failed to upsert database ${rec.id}: ${e}`);
            errorCount++;
          }
        }
      } else {
        console.log(`[notion] Unknown object type in search results: ${objectType}`);
      }
    }

    hasMore = result.has_more;
    startCursor = (result.next_cursor as string | undefined) || undefined;
  }

  // Explicitly fetch data_sources (API 2025-09-03: unfiltered search may not return them)
  const dsResult = syncDataSources(
    upsertDatabase,
    getDatabaseById,
    cutoffMs,
    lastSyncTime,
    isFirstSync
  );
  dbCount += dsResult.count;
  dbSkipped += dsResult.skipped;
  errorCount += dsResult.errors;

  // Record that sync happened (even if first sync was partial)
  state.set('last_search_sync', Date.now());

  const skipMsg =
    pageSkipped > 0 || dbSkipped > 0 ? ` (${pageSkipped} pages, ${dbSkipped} dbs unchanged)` : '';
  const errorMsg = errorCount > 0 ? `, ${errorCount} errors` : '';
  console.log(
    `[notion] Synced ${pageCount} pages, ${dbCount} databases (last 30 days)${skipMsg}${errorMsg}`
  );
}

function syncDataSources(
  upsertDatabase: (db: Record<string, unknown>) => void,
  getDatabaseById: ((id: string) => { last_edited_time: string } | null) | undefined,
  cutoffMs: number,
  lastSyncTime: number,
  isFirstSync: boolean
): { count: number; skipped: number; errors: number } {
  const api = getApi();
  let startCursor: string | undefined;
  let hasMore = true;
  let count = 0;
  let skipped = 0;
  let errors = 0;
  let reachedOldItems = false;

  while (hasMore && !reachedOldItems) {
    const result = api.search({
      page_size: 100,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      filter: { property: 'object', value: 'data_source' },
      ...(startCursor ? { start_cursor: startCursor } : {}),
    });

    for (const item of result.results) {
      const rec = item as Record<string, unknown>;
      const lastEdited = rec.last_edited_time as string;
      if (!lastEdited) continue;

      const editedMs = new Date(lastEdited).getTime();

      if (editedMs < cutoffMs) {
        reachedOldItems = true;
        break;
      }
      if (!isFirstSync && editedMs <= lastSyncTime) {
        reachedOldItems = true;
        break;
      }

      const existing = getDatabaseById?.(rec.id as string);
      if (existing && existing.last_edited_time === lastEdited) {
        skipped++;
      } else {
        try {
          upsertDatabase(rec);
          count++;
        } catch (e) {
          console.error(`[notion] Failed to upsert data_source ${rec.id}: ${e}`);
          errors++;
        }
      }
    }

    hasMore = result.has_more;
    startCursor = (result.next_cursor as string | undefined) || undefined;
  }

  return { count, skipped, errors };
}

// ---------------------------------------------------------------------------
// Phase 2.5: Sync database rows
// For each synced database, query its rows and store them locally.
// ---------------------------------------------------------------------------

/** Max rows to sync per database per sync cycle */
const MAX_ROWS_PER_DATABASE = 200;

function syncDatabaseRows(): void {
  const api = getApi();
  const { getLocalDatabases } = n();

  const upsertDatabaseRow = (globalThis as Record<string, unknown>).upsertDatabaseRow as
    | ((row: Record<string, unknown>, databaseId: string) => void)
    | undefined;
  const getDatabaseRowById = (globalThis as Record<string, unknown>).getDatabaseRowById as
    | ((id: string) => { last_edited_time: string } | null)
    | undefined;

  if (!upsertDatabaseRow) {
    console.warn(
      '[notion] upsertDatabaseRow not available on globalThis — skipping database row sync'
    );
    return;
  }

  // Get all locally synced databases
  const databases = getLocalDatabases({ limit: 100 }) as Array<{ id: string; title: string }>;

  if (databases.length === 0) {
    console.log('[notion] No databases to sync rows for');
    return;
  }

  let totalRowCount = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let dbsSynced = 0;

  for (const database of databases) {
    try {
      let startCursor: string | undefined;
      let hasMore = true;
      let rowCount = 0;
      let skipped = 0;
      let fetched = 0;

      while (hasMore && fetched < MAX_ROWS_PER_DATABASE) {
        const body: Record<string, unknown> = {
          page_size: 100,
          sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
        };
        if (startCursor) body.start_cursor = startCursor;

        let result: { results: Record<string, unknown>[]; has_more: boolean; next_cursor?: string };
        try {
          result = api.queryDataSource(database.id, body) as typeof result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Skip databases we can't query (permissions, deleted, etc.)
          if (
            msg.includes('404') ||
            msg.includes('403') ||
            msg.includes('no data sources') ||
            msg.includes('Could not find')
          ) {
            console.warn(
              `[notion] Cannot query database "${database.title}" (${database.id}): ${msg}`
            );
            break;
          }
          throw e;
        }

        for (const row of result.results) {
          const rec = row as Record<string, unknown>;
          const lastEdited = rec.last_edited_time as string;

          // Skip if unchanged
          const existing = getDatabaseRowById?.(rec.id as string);
          if (existing && existing.last_edited_time === lastEdited) {
            skipped++;
            fetched++;
            continue;
          }

          try {
            upsertDatabaseRow(rec, database.id);
            rowCount++;
          } catch (e) {
            console.error(
              `[notion] Failed to upsert row ${rec.id} in database ${database.id}: ${e}`
            );
            totalErrors++;
          }
          fetched++;
        }

        hasMore = result.has_more;
        startCursor = result.next_cursor as string | undefined;
      }

      totalRowCount += rowCount;
      totalSkipped += skipped;
      if (rowCount > 0 || skipped > 0) dbsSynced++;

      if (rowCount > 0) {
        console.log(
          `[notion] Database "${database.title}": ${rowCount} rows synced${skipped > 0 ? `, ${skipped} unchanged` : ''}`
        );
      }
    } catch (e) {
      console.error(
        `[notion] Failed to sync rows for database "${database.title}" (${database.id}): ${e}`
      );
      totalErrors++;
    }
  }

  const skipMsg = totalSkipped > 0 ? ` (${totalSkipped} unchanged)` : '';
  const errorMsg = totalErrors > 0 ? `, ${totalErrors} errors` : '';
  console.log(
    `[notion] Database row sync: ${totalRowCount} rows across ${dbsSynced} databases${skipMsg}${errorMsg}`
  );
}

// ---------------------------------------------------------------------------
// Phase 3: Sync page content (block text extraction)
// ---------------------------------------------------------------------------

function syncContent(): void {
  const s = globalThis.getNotionSkillState();
  const { fetchBlockTreeText } = n();
  const getPagesNeedingContent = (globalThis as Record<string, unknown>).getPagesNeedingContent as
    | ((limit: number, updatedAfterIso?: string) => Array<{ id: string; title: string }>)
    | undefined;
  const updatePageContent = (globalThis as Record<string, unknown>).updatePageContent as
    | ((pageId: string, text: string) => void)
    | undefined;

  if (!getPagesNeedingContent || !updatePageContent) return;

  const batchSize = s.config.maxPagesPerContentSync;
  const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const pages = getPagesNeedingContent(batchSize, cutoffIso);
  let synced = 0;
  let failed = 0;

  for (const page of pages) {
    try {
      const text = fetchBlockTreeText(page.id, 2);
      updatePageContent(page.id, text);
      synced++;
    } catch (e) {
      // Individual page failures are logged but don't abort the batch
      console.error(`[notion] Failed to sync content for page ${page.id}: ${e}`);
      failed++;
    }
  }

  console.log(
    `[notion] Content sync: ${synced} pages updated${failed > 0 ? `, ${failed} failed` : ''}`
  );
}

// ---------------------------------------------------------------------------
// Phase 4: Sync unsynced summaries to the server
// ---------------------------------------------------------------------------

/**
 * Sync unsynced summaries to the server via net.fetch().
 * Reads summaries with synced=0, submits each to the backend API,
 * and marks them as synced on success.
 */
function syncSummariesToServer(): void {
  const getUnsyncedSummariesFn = (globalThis as Record<string, unknown>).getUnsyncedSummaries as
    | ((
        limit: number
      ) => Array<{
        id: number;
        page_id: string;
        url: string | null;
        summary: string;
        category: string | null;
        sentiment: string | null;
        entities: string | null;
        topics: string | null;
        metadata: string | null;
        source_created_at: string;
        source_updated_at: string;
      }>)
    | undefined;
  const markSummariesSyncedFn = (globalThis as Record<string, unknown>).markSummariesSynced as
    | ((ids: number[]) => void)
    | undefined;

  if (!getUnsyncedSummariesFn || !markSummariesSyncedFn) return;

  const batch = getUnsyncedSummariesFn(100);
  if (batch.length === 0) {
    console.log('[notion] No unsynced summaries to send');
    return;
  }

  // Get backend URL and auth token from environment
  const backendUrl = platform.env('BACKEND_URL');
  const authToken = platform.env('AUTH_TOKEN');

  if (!backendUrl || !authToken) {
    console.warn('[notion] Missing BACKEND_URL or AUTH_TOKEN — skipping summary sync');
    return;
  }

  let sent = 0;
  let failed = 0;
  const syncedIds: number[] = [];

  for (const row of batch) {
    try {
      // Parse stored JSON fields
      const entities: SummaryEntity[] = row.entities ? JSON.parse(row.entities) : [];
      const topics: string[] = row.topics ? JSON.parse(row.topics) : [];
      const metadata: Record<string, unknown> = row.metadata ? JSON.parse(row.metadata) : {};

      const submission: SummarySubmission = {
        summary: row.summary,
        url: row.url || undefined,
        category: row.category || undefined,
        dataSource: 'notion',
        sentiment: (row.sentiment as 'positive' | 'neutral' | 'negative' | 'mixed') || 'neutral',
        keyPoints: topics.length > 0 ? topics : undefined,
        entities: entities.length > 0 ? entities : undefined,
        metadata,
        createdAt: row.source_created_at,
        updatedAt: row.source_updated_at,
      };

      const resp = net.fetch(`${backendUrl}/api/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(submission),
        timeout: 10000,
      });

      if (resp.status >= 400) {
        console.error(`[notion] Summary submit failed (${resp.status}): ${resp.body}`);
        failed++;
        continue;
      }

      syncedIds.push(row.id);
      sent++;
    } catch (e) {
      console.error(`[notion] Failed to sync summary ${row.id} (page ${row.page_id}): ${e}`);
      failed++;
    }
  }

  // Mark successfully sent summaries as synced
  if (syncedIds.length > 0) {
    markSummariesSyncedFn(syncedIds);
  }

  console.log(
    `[notion] Server sync: ${sent} summaries sent${failed > 0 ? `, ${failed} failed` : ''}`
  );
}

// ---------------------------------------------------------------------------
// State publishing helper
// ---------------------------------------------------------------------------

function publishSyncState(): void {
  const s = globalThis.getNotionSkillState();
  const isConnected = !!oauth.getCredential();

  state.setPartial({
    // Standard SkillHostConnectionState fields
    connection_status: isConnected ? 'connected' : 'disconnected',
    auth_status: isConnected ? 'authenticated' : 'not_authenticated',
    connection_error: s.syncStatus.lastSyncError || null,
    auth_error: null,
    is_initialized: isConnected,
    // Skill-specific fields
    workspaceName: s.config.workspaceName || null,
    syncInProgress: s.syncStatus.syncInProgress,
    lastSyncTime: s.syncStatus.lastSyncTime
      ? new Date(s.syncStatus.lastSyncTime).toISOString()
      : null,
    nextSyncTime: s.syncStatus.nextSyncTime
      ? new Date(s.syncStatus.nextSyncTime).toISOString()
      : null,
    totalPages: s.syncStatus.totalPages,
    totalDatabases: s.syncStatus.totalDatabases,
    totalDatabaseRows: s.syncStatus.totalDatabaseRows,
    totalUsers: s.syncStatus.totalUsers,
    pagesWithContent: s.syncStatus.pagesWithContent,
    pagesWithSummary: s.syncStatus.pagesWithSummary,
    summariesTotal: s.syncStatus.summariesTotal,
    summariesPending: s.syncStatus.summariesPending,
    lastSyncError: s.syncStatus.lastSyncError,
    lastSyncDurationMs: s.syncStatus.lastSyncDurationMs,
  });
}

// Expose on globalThis
const _g = globalThis as Record<string, unknown>;
_g.performSync = performSync;
_g.publishSyncState = publishSyncState;
_g.syncDatabaseRows = syncDatabaseRows;
_g.syncSummariesToServer = syncSummariesToServer;

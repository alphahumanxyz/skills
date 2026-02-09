// notion/index.ts
// Notion integration skill exposing 25 tools for the Notion API + local sync.
// Supports pages, databases, blocks, users, comments, and local search.
// Authentication is handled via the platform OAuth bridge.
import './api/index';
import './db-helpers';
import './db-schema';
import './skill-state';
import type { NotionSkillConfig } from './skill-state';
import { performSync } from './sync';
import tools from './tools/index';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log('[notion] Initializing');
  const s = globalThis.getNotionSkillState();

  // Initialize database schema
  const initSchema = (globalThis as { initializeNotionSchema?: () => void }).initializeNotionSchema;
  if (initSchema) initSchema();

  // Load persisted config from store
  const saved = state.get('config') as Partial<NotionSkillConfig> | null;
  if (saved) {
    s.config.credentialId = saved.credentialId || s.config.credentialId;
    s.config.workspaceName = saved.workspaceName || s.config.workspaceName;
    s.config.syncIntervalMinutes = saved.syncIntervalMinutes || s.config.syncIntervalMinutes;
    s.config.contentSyncEnabled = saved.contentSyncEnabled ?? s.config.contentSyncEnabled;
    s.config.maxPagesPerContentSync =
      saved.maxPagesPerContentSync || s.config.maxPagesPerContentSync;
  }

  // Load sync state from store (lastSyncTime may be an ISO string from
  // setPartial or a number from legacy last_sync_time; parse tolerantly)
  const lastSync = state.get('lastSyncTime') as string | number | null;
  if (lastSync) {
    s.syncStatus.lastSyncTime =
      typeof lastSync === 'number' ? lastSync : new Date(lastSync).getTime();
  }

  // Load entity counts
  const getEntityCounts = (
    globalThis as {
      getEntityCounts?: () => {
        pages: number;
        databases: number;
        databaseRows: number;
        users: number;
        pagesWithContent: number;
        pagesWithSummary: number;
      };
    }
  ).getEntityCounts;
  if (getEntityCounts) {
    const counts = getEntityCounts();
    s.syncStatus.totalPages = counts.pages;
    s.syncStatus.totalDatabases = counts.databases;
    s.syncStatus.totalDatabaseRows = counts.databaseRows;
    s.syncStatus.totalUsers = counts.users;
    s.syncStatus.pagesWithContent = counts.pagesWithContent;
    s.syncStatus.pagesWithSummary = counts.pagesWithSummary;
  }

  const cred = oauth.getCredential();
  if (cred) {
    s.config.credentialId = cred.credentialId;
    console.log(`[notion] Connected to workspace: ${s.config.workspaceName || '(unnamed)'}`);
  } else {
    console.log('[notion] No OAuth credential — waiting for setup');
  }

  publishState();
}

function start(): void {
  const s = globalThis.getNotionSkillState();

  if (!oauth.getCredential()) {
    console.log('[notion] No credential — skill inactive until OAuth completes');
    return;
  }

  // Register sync cron schedule
  const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
  cron.register('notion-sync', cronExpr);
  console.log(`[notion] Scheduled sync every ${s.config.syncIntervalMinutes} minutes`);

  // Perform initial sync (skip if sync was attempted in the last 10 mins)
  const TEN_MINS_MS = 10 * 60 * 1000;
  const lastSync = s.syncStatus.lastSyncTime;
  const recentlySynced = lastSync > 0 && Date.now() - lastSync < TEN_MINS_MS;
  if (!recentlySynced) {
    performSync();
  } else if (recentlySynced) {
    console.log('[notion] Skipping initial sync — last sync was within 10 minutes');
  }

  console.log('[notion] Started');
  publishState();
}

function stop(): void {
  console.log('[notion] Stopping');
  const s = globalThis.getNotionSkillState();

  // Unregister cron
  cron.unregister('notion-sync');

  // Persist config
  state.set('config', s.config);

  state.set('status', 'stopped');
  console.log('[notion] Stopped');
}

function onCronTrigger(scheduleId: string): void {
  console.log(`[notion] Cron triggered: ${scheduleId}`);

  if (scheduleId === 'notion-sync') {
    performSync();
  }
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function onSessionStart(args: { sessionId: string }): void {
  const s = globalThis.getNotionSkillState();
  s.activeSessions.push(args.sessionId);
}

function onSessionEnd(args: { sessionId: string }): void {
  const s = globalThis.getNotionSkillState();
  const index = s.activeSessions.indexOf(args.sessionId);
  if (index > -1) {
    s.activeSessions.splice(index, 1);
  }
}

// ---------------------------------------------------------------------------
// OAuth lifecycle
// ---------------------------------------------------------------------------

function onOAuthComplete(args: OAuthCompleteArgs): OAuthCompleteResult | void {
  const s = globalThis.getNotionSkillState();
  s.config.credentialId = args.credentialId;
  console.log(
    `[notion] OAuth complete — credential: ${args.credentialId}, account: ${args.accountLabel || '(unknown)'}`
  );

  if (args.accountLabel) {
    s.config.workspaceName = args.accountLabel;
  }

  state.set('config', s.config);

  // Start sync schedule and trigger initial sync
  const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
  cron.register('notion-sync', cronExpr);

  performSync();
  publishState();
}

function onOAuthRevoked(args: OAuthRevokedArgs): void {
  console.log(`[notion] OAuth revoked — reason: ${args.reason}`);
  const s = globalThis.getNotionSkillState();

  s.config.credentialId = '';
  s.config.workspaceName = '';
  state.delete('config');
  cron.unregister('notion-sync');
  publishState();
}

function onDisconnect(): void {
  console.log('[notion] Disconnecting');
  const s = globalThis.getNotionSkillState();

  oauth.revoke();
  s.config.credentialId = '';
  s.config.workspaceName = '';
  state.delete('config');
  cron.unregister('notion-sync');
  publishState();
}

// ---------------------------------------------------------------------------
// Options system
// ---------------------------------------------------------------------------

function onListOptions(): { options: SkillOption[] } {
  const s = globalThis.getNotionSkillState();

  return {
    options: [
      {
        name: 'syncInterval',
        type: 'select',
        label: 'Sync Interval',
        value: s.config.syncIntervalMinutes.toString(),
        options: [
          { label: 'Every 10 minutes', value: '10' },
          { label: 'Every 20 minutes', value: '20' },
          { label: 'Every 30 minutes', value: '30' },
          { label: 'Every hour', value: '60' },
        ],
      },
      {
        name: 'contentSyncEnabled',
        type: 'boolean',
        label: 'Sync Page Content',
        value: s.config.contentSyncEnabled,
      },
      {
        name: 'maxPagesPerContentSync',
        type: 'select',
        label: 'Pages Per Content Sync',
        value: s.config.maxPagesPerContentSync.toString(),
        options: [
          { label: '25 pages', value: '25' },
          { label: '50 pages', value: '50' },
          { label: '100 pages', value: '100' },
        ],
      },
    ],
  };
}

function onSetOption(args: { name: string; value: unknown }): void {
  const s = globalThis.getNotionSkillState();
  const credential = oauth.getCredential();

  switch (args.name) {
    case 'syncInterval':
      s.config.syncIntervalMinutes = parseInt(args.value as string, 10);
      if (credential) {
        cron.unregister('notion-sync');
        const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
        cron.register('notion-sync', cronExpr);
      }
      break;

    case 'contentSyncEnabled':
      s.config.contentSyncEnabled = Boolean(args.value);
      break;

    case 'maxPagesPerContentSync':
      s.config.maxPagesPerContentSync = parseInt(args.value as string, 10);
      break;
  }

  state.set('config', s.config);
  publishState();
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishState(): void {
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
    totalPages: s.syncStatus.totalPages,
    totalDatabases: s.syncStatus.totalDatabases,
    totalDatabaseRows: s.syncStatus.totalDatabaseRows,
    totalUsers: s.syncStatus.totalUsers,
    pagesWithContent: s.syncStatus.pagesWithContent,
    pagesWithSummary: s.syncStatus.pagesWithSummary,
    lastSyncError: s.syncStatus.lastSyncError,
  });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Expose lifecycle hooks on globalThis so the REPL/runtime can call them.
// esbuild IIFE bundling traps function declarations in the closure scope —
// without explicit assignment they are unreachable from outside.
// ---------------------------------------------------------------------------

const skill: Skill = {
  info: {
    id: 'notion',
    name: 'Notion',
    version: '2.1.0', // Bumped for persistent storage
    description: 'Notion integration with persistent storage',
    auto_start: false,
    setup: { required: true, label: 'Configure Notion' },
  },
  tools,
  init,
  start,
  stop,
  onCronTrigger,
  onSessionStart,
  onSessionEnd,
  onOAuthComplete,
  onOAuthRevoked,
  onDisconnect,
  onListOptions,
  onSetOption,
  publishState,
};

console.log('skill-tools', skill.tools);

export default skill;

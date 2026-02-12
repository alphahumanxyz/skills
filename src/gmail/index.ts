// Gmail skill main entry point
// Gmail integration with OAuth bridge, email management, and real-time sync
import { loadGmailProfile } from './api/helpers';
import { getSyncState, setSyncState } from './db/helpers';
import { initializeGmailSchema } from './db/schema';
import { getGmailSkillState, publishSkillState } from './state';
import { isSyncCompleted, onSync, performInitialSync } from './sync';
import { tools } from './tools';
import type { SkillConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  console.log(`[gmail] Initializing on ${platform.os()}`);
  const s = getGmailSkillState();

  // Initialize database schema
  initializeGmailSchema();

  // Load persisted config from store
  const saved = state.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    s.config.credentialId = saved.credentialId || s.config.credentialId;
    s.config.userEmail = saved.userEmail || s.config.userEmail;
    s.config.syncEnabled = saved.syncEnabled ?? s.config.syncEnabled;
    s.config.syncIntervalMinutes = saved.syncIntervalMinutes || s.config.syncIntervalMinutes;
    s.config.maxEmailsPerSync = saved.maxEmailsPerSync || s.config.maxEmailsPerSync;
    s.config.notifyOnNewEmails = saved.notifyOnNewEmails ?? s.config.notifyOnNewEmails;
    s.config.showSensitiveMessages = saved.showSensitiveMessages ?? s.config.showSensitiveMessages;
  }

  // Load sync status
  const lastSync = getSyncState('last_sync_time');
  const lastHistoryId = getSyncState('last_history_id');
  if (lastSync) s.syncStatus.lastSyncTime = parseInt(lastSync, 10);
  if (lastHistoryId) s.syncStatus.lastHistoryId = lastHistoryId;

  const isConnected = !!oauth.getCredential();
  console.log(`[gmail] Initialized. Connected: ${isConnected}`);
}

async function start(): Promise<void> {
  console.log('[gmail] Starting skill...');
  const s = getGmailSkillState();
  const credential = oauth.getCredential();

  if (credential && s.config.syncEnabled) {
    // Schedule periodic sync
    const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
    cron.register('gmail-sync', cronExpr);
    console.log(`[gmail] Scheduled sync every ${s.config.syncIntervalMinutes} minutes`);

    // Load Gmail profile
    loadGmailProfile();

    // Run initial sync if not yet completed
    if (!isSyncCompleted()) {
      console.log('[gmail] Initial sync not completed, starting...');
      performInitialSync((msg, pct) => {
        console.log(`[gmail] Sync progress: ${msg} (${pct}%)`);
      });
    }

    // Publish initial state
    publishSkillState();
  } else {
    console.log('[gmail] Not connected or sync disabled');
  }
}

async function stop(): Promise<void> {
  console.log('[gmail] Stopping skill...');
  const s = getGmailSkillState();

  // Unregister cron schedules
  cron.unregister('gmail-sync');

  // Save current state
  state.set('config', s.config);

  setSyncState('last_sync_time', s.syncStatus.lastSyncTime.toString());
  setSyncState('last_history_id', s.syncStatus.lastHistoryId);

  console.log('[gmail] Skill stopped');
}

async function onCronTrigger(scheduleId: string): Promise<void> {
  console.log(`[gmail] Cron triggered: ${scheduleId}`);
  if (scheduleId === 'gmail-sync') {
    await onSync();
  }
}

async function onSessionStart(args: { sessionId: string }): Promise<void> {
  const s = getGmailSkillState();
  s.activeSessions.push(args.sessionId);
  console.log(`[gmail] Session started: ${args.sessionId} (${s.activeSessions.length} active)`);
}

async function onSessionEnd(args: { sessionId: string }): Promise<void> {
  const s = getGmailSkillState();
  const index = s.activeSessions.indexOf(args.sessionId);
  if (index > -1) {
    s.activeSessions.splice(index, 1);
  }
  console.log(`[gmail] Session ended: ${args.sessionId} (${s.activeSessions.length} active)`);
}

// ---------------------------------------------------------------------------
// OAuth lifecycle hooks
// ---------------------------------------------------------------------------

async function onOAuthComplete(args: OAuthCompleteArgs): Promise<OAuthCompleteResult | void> {
  console.log(`[gmail] OAuth complete for provider: ${args.provider}`);
  const s = getGmailSkillState();

  s.config.credentialId = args.credentialId;
  if (args.accountLabel) {
    s.config.userEmail = args.accountLabel;
  }

  state.set('config', s.config);

  // Load profile to get user email
  loadGmailProfile();

  publishSkillState();
  console.log(`[gmail] Connected as ${s.config.userEmail || args.accountLabel || 'unknown'}`);
}

async function onOAuthRevoked(args: OAuthRevokedArgs): Promise<void> {
  console.log(`[gmail] OAuth revoked: ${args.reason}`);
  const s = getGmailSkillState();

  s.config.credentialId = '';
  s.config.userEmail = '';
  s.profile = null;

  state.set('config', s.config);
  cron.unregister('gmail-sync');
  publishSkillState();

  if (args.reason === 'token_expired' || args.reason === 'provider_revoked') {
    platform.notify('Gmail Disconnected', 'Your Gmail connection has expired. Please reconnect.');
  }
}

async function onDisconnect(): Promise<void> {
  console.log('[gmail] Disconnecting...');
  const s = getGmailSkillState();

  // Revoke via OAuth bridge
  oauth.revoke();

  // Reset configuration
  s.config = {
    credentialId: '',
    userEmail: '',
    syncEnabled: true,
    syncIntervalMinutes: 15,
    maxEmailsPerSync: 100,
    notifyOnNewEmails: true,
  };

  s.profile = null;
  state.delete('config');
  cron.unregister('gmail-sync');
  publishSkillState();

  console.log('[gmail] Disconnected and cleaned up');
}

// ---------------------------------------------------------------------------
// Options system
// ---------------------------------------------------------------------------

async function onListOptions(): Promise<{ options: SkillOption[] }> {
  const s = getGmailSkillState();

  return {
    options: [
      {
        name: 'syncEnabled',
        type: 'boolean',
        label: 'Enable Email Sync',
        value: s.config.syncEnabled,
      },
      {
        name: 'syncInterval',
        type: 'select',
        label: 'Sync Interval',
        value: s.config.syncIntervalMinutes.toString(),
        options: [
          { label: 'Every 5 minutes', value: '5' },
          { label: 'Every 15 minutes', value: '15' },
          { label: 'Every 30 minutes', value: '30' },
          { label: 'Every hour', value: '60' },
        ],
      },
      {
        name: 'maxEmailsPerSync',
        type: 'select',
        label: 'Max Emails Per Sync',
        value: s.config.maxEmailsPerSync.toString(),
        options: [
          { label: '50 emails', value: '50' },
          { label: '100 emails', value: '100' },
          { label: '250 emails', value: '250' },
          { label: '500 emails', value: '500' },
        ],
      },
      {
        name: 'notifyOnNewEmails',
        type: 'boolean',
        label: 'Notify on New Emails',
        value: s.config.notifyOnNewEmails,
      },
      {
        name: 'showSensitiveMessages',
        type: 'boolean',
        label: 'Show Sensitive Messages',
        value: s.config.showSensitiveMessages ?? false,
      },
    ],
  };
}

async function onSetOption(args: { name: string; value: unknown }): Promise<void> {
  const s = getGmailSkillState();
  const credential = oauth.getCredential();

  switch (args.name) {
    case 'syncEnabled':
      s.config.syncEnabled = Boolean(args.value);
      if (s.config.syncEnabled && credential) {
        const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
        cron.register('gmail-sync', cronExpr);
      } else {
        cron.unregister('gmail-sync');
      }
      break;

    case 'syncInterval':
      s.config.syncIntervalMinutes = parseInt(args.value as string, 10);
      if (s.config.syncEnabled && credential) {
        cron.unregister('gmail-sync');
        const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
        cron.register('gmail-sync', cronExpr);
      }
      break;

    case 'maxEmailsPerSync':
      s.config.maxEmailsPerSync = parseInt(args.value as string, 10);
      break;

    case 'notifyOnNewEmails':
      s.config.notifyOnNewEmails = Boolean(args.value);
      break;

    case 'showSensitiveMessages':
      s.config.showSensitiveMessages = Boolean(args.value);
      break;
  }

  // Save updated config
  state.set('config', s.config);
  publishSkillState();
}

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const skill: Skill = {
  info: {
    id: 'gmail',
    name: 'Gmail',
    version: '2.1.0',
    description: 'Gmail integration with persistent storage',
    auto_start: false,
    setup: { required: true, label: 'Configure Gmail' },
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
  onSync,
  onDisconnect,
  onListOptions,
  onSetOption,
};

export default skill;

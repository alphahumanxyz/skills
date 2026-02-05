// Gmail skill main entry point
// Comprehensive Gmail integration with OAuth2, email management, and real-time sync

// Import all tools
import { getEmailsTool } from './tools/get-emails';
import { sendEmailTool } from './tools/send-email';
import { getEmailTool } from './tools/get-email';
import { getLabelsTool } from './tools/get-labels';
import { searchEmailsTool } from './tools/search-emails';
import { markEmailTool } from './tools/mark-email';
import { getProfileTool } from './tools/get-profile';

// Import modules to initialize state and expose functions on globalThis
import './skill-state';
import './auth-helpers';
import './db-schema';
import './db-helpers';

import type { SetupSubmitArgs, OAuth2Config, SkillConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log(`[gmail] Initializing on ${platform.os()}`);
  const s = globalThis.getGmailSkillState();

  // Initialize database schema
  const initSchema = (globalThis as { initializeGmailSchema?: () => void }).initializeGmailSchema;
  if (initSchema) {
    initSchema();
  }

  // Load persisted config from store
  const saved = store.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    s.config.clientId = saved.clientId || s.config.clientId;
    s.config.clientSecret = saved.clientSecret || s.config.clientSecret;
    s.config.refreshToken = saved.refreshToken || s.config.refreshToken;
    s.config.accessToken = saved.accessToken || s.config.accessToken;
    s.config.tokenExpiry = saved.tokenExpiry || s.config.tokenExpiry;
    s.config.userEmail = saved.userEmail || s.config.userEmail;
    s.config.isAuthenticated = saved.isAuthenticated || s.config.isAuthenticated;
    s.config.syncEnabled = saved.syncEnabled ?? s.config.syncEnabled;
    s.config.syncIntervalMinutes = saved.syncIntervalMinutes || s.config.syncIntervalMinutes;
    s.config.maxEmailsPerSync = saved.maxEmailsPerSync || s.config.maxEmailsPerSync;
    s.config.notifyOnNewEmails = saved.notifyOnNewEmails ?? s.config.notifyOnNewEmails;
  }

  // Load sync status
  const getSyncState = (globalThis as { getSyncState?: (key: string) => string | null }).getSyncState;
  if (getSyncState) {
    const lastSync = getSyncState('last_sync_time');
    const lastHistoryId = getSyncState('last_history_id');
    if (lastSync) s.syncStatus.lastSyncTime = parseInt(lastSync, 10);
    if (lastHistoryId) s.syncStatus.lastHistoryId = lastHistoryId;
  }

  console.log(`[gmail] Initialized. Authenticated: ${s.config.isAuthenticated}`);
}

function start(): void {
  console.log('[gmail] Starting skill...');
  const s = globalThis.getGmailSkillState();

  if (s.config.isAuthenticated && s.config.syncEnabled) {
    // Schedule periodic sync
    const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`; // Every N minutes
    cron.register('gmail-sync', cronExpr);
    console.log(`[gmail] Scheduled sync every ${s.config.syncIntervalMinutes} minutes`);

    // Load Gmail profile
    loadGmailProfile();

    // Perform initial sync
    performSync();

    // Publish initial state
    publishSkillState();
  } else {
    console.log('[gmail] Not authenticated, sync disabled');
  }
}

function stop(): void {
  console.log('[gmail] Stopping skill...');
  const s = globalThis.getGmailSkillState();

  // Unregister cron schedules
  cron.unregister('gmail-sync');

  // Save current state
  store.set('config', s.config);

  const setSyncState = (globalThis as { setSyncState?: (key: string, value: string) => void }).setSyncState;
  if (setSyncState) {
    setSyncState('last_sync_time', s.syncStatus.lastSyncTime.toString());
    setSyncState('last_history_id', s.syncStatus.lastHistoryId);
  }

  console.log('[gmail] Skill stopped');
}

function onCronTrigger(scheduleId: string): void {
  console.log(`[gmail] Cron triggered: ${scheduleId}`);

  if (scheduleId === 'gmail-sync') {
    performSync();
  }
}

function onSessionStart(args: { sessionId: string }): void {
  const s = globalThis.getGmailSkillState();
  s.activeSessions.push(args.sessionId);
  console.log(`[gmail] Session started: ${args.sessionId} (${s.activeSessions.length} active)`);
}

function onSessionEnd(args: { sessionId: string }): void {
  const s = globalThis.getGmailSkillState();
  const index = s.activeSessions.indexOf(args.sessionId);
  if (index > -1) {
    s.activeSessions.splice(index, 1);
  }
  console.log(`[gmail] Session ended: ${args.sessionId} (${s.activeSessions.length} active)`);
}

// ---------------------------------------------------------------------------
// Setup flow
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  return {
    step: {
      id: 'oauth_credentials',
      title: 'Gmail OAuth2 Credentials',
      description: 'Enter your Google OAuth2 credentials to connect Gmail. You can get these from Google Cloud Console.',
      fields: [
        {
          name: 'clientId',
          type: 'text',
          label: 'Client ID',
          description: 'OAuth2 Client ID from Google Cloud Console',
          required: true,
        },
        {
          name: 'clientSecret',
          type: 'password',
          label: 'Client Secret',
          description: 'OAuth2 Client Secret from Google Cloud Console',
          required: true,
        },
      ],
    },
  };
}

function onSetupSubmit(args: SetupSubmitArgs): SetupSubmitResult {
  const s = globalThis.getGmailSkillState();

  if (args.stepId === 'oauth_credentials') {
    const clientId = args.values.clientId as string;
    const clientSecret = args.values.clientSecret as string;

    if (!clientId || !clientSecret) {
      return {
        status: 'error',
        errors: [
          { field: 'clientId', message: 'Client ID is required' },
          { field: 'clientSecret', message: 'Client Secret is required' },
        ],
      };
    }

    // Save credentials
    s.config.clientId = clientId;
    s.config.clientSecret = clientSecret;

    // Generate authorization URL
    const generateAuthUrl = (globalThis as { generateAuthUrl?: (config: OAuth2Config) => string })
      .generateAuthUrl;

    if (generateAuthUrl) {
      const oauthConfig: OAuth2Config = {
        clientId,
        clientSecret,
        redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels',
      };

      const authUrl = generateAuthUrl(oauthConfig);

      return {
        status: 'next',
        nextStep: {
          id: 'authorization',
          title: 'Authorize Gmail Access',
          description: `Please visit the following URL to authorize Gmail access, then paste the authorization code below:\n\n${authUrl}`,
          fields: [
            {
              name: 'authCode',
              type: 'text',
              label: 'Authorization Code',
              description: 'The code provided after authorizing access',
              required: true,
            },
          ],
        },
      };
    }

    return {
      status: 'error',
      errors: [{ field: 'clientId', message: 'Failed to generate authorization URL' }],
    };
  }

  if (args.stepId === 'authorization') {
    const authCode = args.values.authCode as string;

    if (!authCode) {
      return {
        status: 'error',
        errors: [{ field: 'authCode', message: 'Authorization code is required' }],
      };
    }

    // Exchange code for tokens
    const exchangeCode = (globalThis as { exchangeCodeForTokens?: (code: string, config: OAuth2Config) => any })
      .exchangeCodeForTokens;

    if (exchangeCode) {
      const oauthConfig: OAuth2Config = {
        clientId: s.config.clientId,
        clientSecret: s.config.clientSecret,
        redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels',
      };

      const tokens = exchangeCode(authCode, oauthConfig);

      if (tokens) {
        s.config.accessToken = tokens.access_token;
        s.config.refreshToken = tokens.refresh_token;
        s.config.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
        s.config.isAuthenticated = true;

        // Save config
        store.set('config', s.config);

        // Load profile to get user email
        loadGmailProfile();

        return { status: 'complete' };
      }
    }

    return {
      status: 'error',
      errors: [{ field: 'authCode', message: 'Invalid authorization code or failed to exchange for tokens' }],
    };
  }

  return {
    status: 'error',
    errors: [{ field: 'stepId', message: 'Unknown setup step' }],
  };
}

function onSetupCancel(): void {
  console.log('[gmail] Setup cancelled');
}

function onDisconnect(): void {
  const s = globalThis.getGmailSkillState();

  // Revoke tokens
  const revokeToken = (globalThis as { revokeToken?: (token: string) => boolean }).revokeToken;
  if (revokeToken && s.config.refreshToken) {
    revokeToken(s.config.refreshToken);
  }

  // Reset configuration
  s.config = {
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    accessToken: '',
    tokenExpiry: 0,
    userEmail: '',
    isAuthenticated: false,
    syncEnabled: true,
    syncIntervalMinutes: 15,
    maxEmailsPerSync: 100,
    notifyOnNewEmails: true,
  };

  store.delete('config');

  // Stop sync
  cron.unregister('gmail-sync');

  console.log('[gmail] Disconnected and cleaned up');
}

// ---------------------------------------------------------------------------
// Options system
// ---------------------------------------------------------------------------

function onListOptions(): { options: SkillOption[] } {
  const s = globalThis.getGmailSkillState();

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
    ],
  };
}

function onSetOption(args: { name: string; value: unknown }): void {
  const s = globalThis.getGmailSkillState();

  switch (args.name) {
    case 'syncEnabled':
      s.config.syncEnabled = Boolean(args.value);
      if (s.config.syncEnabled && s.config.isAuthenticated) {
        const cronExpr = `0 */${s.config.syncIntervalMinutes} * * * *`;
        cron.register('gmail-sync', cronExpr);
      } else {
        cron.unregister('gmail-sync');
      }
      break;

    case 'syncInterval':
      s.config.syncIntervalMinutes = parseInt(args.value as string, 10);
      if (s.config.syncEnabled && s.config.isAuthenticated) {
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
  }

  // Save updated config
  store.set('config', s.config);
  publishSkillState();
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function loadGmailProfile(): void {
  const makeApi = (globalThis as { makeApiRequest?: (endpoint: string, options?: any) => any })
    .makeApiRequest;

  if (makeApi) {
    const response = makeApi('/users/me/profile');
    if (response.success) {
      const s = globalThis.getGmailSkillState();
      s.profile = {
        emailAddress: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal || 0,
        threadsTotal: response.data.threadsTotal || 0,
        historyId: response.data.historyId,
      };

      if (!s.config.userEmail) {
        s.config.userEmail = response.data.emailAddress;
        store.set('config', s.config);
      }

      console.log(`[gmail] Profile loaded for ${s.profile.emailAddress}`);
    }
  }
}

function performSync(): void {
  const s = globalThis.getGmailSkillState();

  if (!s.config.isAuthenticated || s.syncStatus.syncInProgress) {
    return;
  }

  console.log('[gmail] Starting email sync...');
  s.syncStatus.syncInProgress = true;
  s.syncStatus.newEmailsCount = 0;

  const makeApi = (globalThis as { makeApiRequest?: (endpoint: string, options?: any) => any })
    .makeApiRequest;
  const upsertEmail = (globalThis as { upsertEmail?: (msg: any) => void }).upsertEmail;

  if (!makeApi || !upsertEmail) return;

  try {
    // Get recent messages
    const params: string[] = [];
    params.push(`maxResults=${s.config.maxEmailsPerSync}`);
    params.push('q=in%3Ainbox'); // Focus on inbox for initial sync

    const response = makeApi(`/users/me/messages?${params.join('&')}`);

    if (response.success && response.data.messages) {
      let newEmails = 0;

      for (const msgRef of response.data.messages) {
        const msgResponse = makeApi(`/users/me/messages/${msgRef.id}`);
        if (msgResponse.success) {
          upsertEmail(msgResponse.data);
          newEmails++;
        }
      }

      s.syncStatus.newEmailsCount = newEmails;

      if (newEmails > 0 && s.config.notifyOnNewEmails) {
        platform.notify(
          'Gmail Sync Complete',
          `Synchronized ${newEmails} emails`
        );
      }
    }

    s.syncStatus.lastSyncTime = Date.now();
    s.syncStatus.nextSyncTime = Date.now() + (s.config.syncIntervalMinutes * 60 * 1000);

    console.log(`[gmail] Sync completed. New emails: ${s.syncStatus.newEmailsCount}`);
  } catch (error) {
    console.error(`[gmail] Sync failed: ${error}`);
    s.lastApiError = error instanceof Error ? error.message : String(error);
  } finally {
    s.syncStatus.syncInProgress = false;
    publishSkillState();
  }
}

function publishSkillState(): void {
  const s = globalThis.getGmailSkillState();

  state.setPartial({
    authenticated: s.config.isAuthenticated,
    userEmail: s.config.userEmail,
    syncEnabled: s.config.syncEnabled,
    syncInProgress: s.syncStatus.syncInProgress,
    lastSyncTime: new Date(s.syncStatus.lastSyncTime).toISOString(),
    nextSyncTime: new Date(s.syncStatus.nextSyncTime).toISOString(),
    totalEmails: s.syncStatus.totalEmails,
    newEmailsCount: s.syncStatus.newEmailsCount,
    activeSessions: s.activeSessions.length,
    rateLimitRemaining: s.rateLimitRemaining,
    lastError: s.lastApiError,
  });
}

// Expose helper functions on globalThis for tools to use
const _g = globalThis as Record<string, unknown>;
_g.performSync = performSync;
_g.publishSkillState = publishSkillState;
_g.loadGmailProfile = loadGmailProfile;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const gmailTools = [
  getEmailsTool,
  sendEmailTool,
  getEmailTool,
  getLabelsTool,
  searchEmailsTool,
  markEmailTool,
  getProfileTool,
];

// Export skill object
const skill = {
  info: {
    id: 'gmail',
    name: 'Gmail',
    runtime: 'v8' as const,
    entry: 'index.js',
    version: '1.0.0',
    description: 'Gmail integration via Google API — comprehensive email management with OAuth2 authentication, send/receive, labels, search, and attachments.',
    auto_start: false,
    setup: { required: true, label: 'Connect Gmail' },
  },
  tools: gmailTools,
  init,
  start,
  stop,
  onCronTrigger,
  onSessionStart,
  onSessionEnd,
  onSetupStart,
  onSetupSubmit,
  onSetupCancel,
  onDisconnect,
  onListOptions,
  onSetOption,
};

export default skill;
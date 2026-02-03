// telegram/index.ts
// Telegram integration skill using gramjs library via V8 runtime.
// Provides tools for Telegram API access with async request queue pattern.

// Import skill state (initializes globalThis.getSkillState)
import './skill-state';
import type { SetupSubmitArgs } from './skill-state';

import { TelegramClient } from 'telegram';


// Runtime globals (store, state, platform, db, cron, tools) are declared in types/globals.d.ts

// ---------------------------------------------------------------------------
// Import gramjs components (bundled with polyfills)
// ---------------------------------------------------------------------------

// The gramjs bundle exposes TelegramClient and other exports globally as GramJS
// after bundling. The gramjs folder is NOT compiled by TypeScript - it's bundled
// separately by esbuild with polyfills.

// Runtime types for gramjs (actual implementation provided by bundled gramjs)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GramJSClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GramJSSession = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GramJSApi = any;

// GramJS global is injected by the bundled gramjs code
declare const GramJS: {
  TelegramClient: new (
    session: GramJSSession,
    apiId: number,
    apiHash: string,
    options: { connectionRetries?: number; useWSS?: boolean }
  ) => GramJSClient;
  StringSession: new (session?: string) => GramJSSession;
  Api: GramJSApi;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_INTERVAL_MS = 100; // Check every 100ms for pending requests

// ---------------------------------------------------------------------------
// Database Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS telegram_requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  args TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_telegram_requests_status ON telegram_requests(status);
CREATE INDEX IF NOT EXISTS idx_telegram_requests_created ON telegram_requests(created_at);
`;


// ---------------------------------------------------------------------------
// Client Management
// ---------------------------------------------------------------------------

async function initClient(): Promise<void> {
  const s = globalThis.getSkillState();
  const stringSession = new GramJS.StringSession(s.config.sessionString || '');
  const apiId = s.config.apiId;
  const apiHash = s.config.apiHash;

  s.clientConnecting = true;
  s.clientError = null;
  publishState();

  console.log('[telegram] Creating TelegramClient with apiId:', apiId);

  try {
    const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

    console.log('[telegram] Connecting to Telegram servers...');
    await client.connect();
    console.log('[telegram] Connected successfully');

    // Test connectivity with help.getAppConfig (no auth required)
    try {
      console.log('[telegram] Testing connectivity with help.getAppConfig...');
      const appConfig = await client.invoke(new GramJS.Api.help.GetAppConfig({ hash: 0 }));
      console.log('[telegram] Connectivity test passed - received app config');
      // Log a small sample of the config to confirm it's working
      if (appConfig && typeof appConfig === 'object') {
        console.log('[telegram] App config type:', appConfig.className || 'unknown');
      }
    } catch (configErr) {
      // This is not fatal - just log the connectivity test failure
      console.warn('[telegram] Connectivity test (help.getAppConfig) failed:', configErr);
    }

    // Assign to state
    s.client = client;

    const authorized = await client.checkAuthorization();
    console.log('[telegram] Authorization check:', authorized ? 'authorized' : 'not authorized');

    if (authorized) {
      s.config.isAuthenticated = true;
      // StringSession.save() returns string, but abstract Session declares void
      const sessionStr = (client.session.save as () => string)();
      if (sessionStr) {
        s.config.sessionString = sessionStr;
        store.set('config', s.config);
      }
      await loadMe();
    }

    s.clientConnecting = false;
    publishState();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[telegram] Failed to connect:', errorMsg);
    s.clientError = errorMsg;
    s.clientConnecting = false;
    s.client = null;
    publishState();
    throw err;
  }
}

async function loadMe(): Promise<void> {
  const s = globalThis.getSkillState();
  if (!s.client) return;
  try {
    const me = await s.client.getMe();
    if (me) {
      s.cache.me = {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        phoneNumber: me.phone,
        isBot: me.bot,
        isPremium: me.premium,
      };
      s.cache.lastSync = Date.now();
    }
  } catch (e) {
    console.error('[telegram] Failed to load me:', e);
  }
}

// ---------------------------------------------------------------------------
// Request Processing
// ---------------------------------------------------------------------------

async function processRequest(request: TelegramRequest): Promise<void> {
  const s = globalThis.getSkillState();
  const { id, type, args: argsStr } = request;
  const args = JSON.parse(argsStr);

  console.log(`[telegram] Processing request ${id}: ${type}`);
  updateRequest(id, 'processing');

  try {
    let result: unknown;

    switch (type) {
      case 'connect':
        await initClient();
        result = { connected: s.client !== null, error: s.clientError };
        break;

      case 'send-code':
        if (!s.client) throw new Error('Client not connected');
        const sendCodeResult = await s.client.sendCode(
          { apiId: s.config.apiId, apiHash: s.config.apiHash },
          args.phoneNumber
        );
        s.config.phoneCodeHash = sendCodeResult.phoneCodeHash;
        s.config.phoneNumber = args.phoneNumber;
        s.config.pendingCode = true;
        store.set('config', s.config);
        result = {
          phoneCodeHash: sendCodeResult.phoneCodeHash,
          isCodeViaApp: sendCodeResult.isCodeViaApp,
        };
        break;

      case 'sign-in':
        if (!s.client) throw new Error('Client not connected');
        if (!s.config.phoneCodeHash) throw new Error('No pending code');
        await s.client.invoke(
          new GramJS.Api.auth.SignIn({
            phoneNumber: s.config.phoneNumber,
            phoneCodeHash: s.config.phoneCodeHash,
            phoneCode: args.code,
          })
        );
        s.config.isAuthenticated = true;
        s.config.pendingCode = false;
        const sessionStr = s.client.session.save();
        if (sessionStr) {
          s.config.sessionString = sessionStr;
        }
        store.set('config', s.config);
        await loadMe();
        result = { success: true, user: s.cache.me };
        break;

      case 'get-me':
        if (!s.client) throw new Error('Client not connected');
        if (!s.config.isAuthenticated) throw new Error('Not authenticated');
        await loadMe();
        result = s.cache.me;
        break;

      case 'get-dialogs':
        if (!s.client) throw new Error('Client not connected');
        if (!s.config.isAuthenticated) throw new Error('Not authenticated');
        const dialogs = await s.client.getDialogs({ limit: args.limit || 20 });
        s.cache.dialogs = dialogs.map(
          (d: {
            id: unknown;
            title: unknown;
            isUser: unknown;
            isGroup: unknown;
            unreadCount: unknown;
            message: { message: unknown } | null;
          }) => ({
            id: String(d.id),
            title: String(d.title || ''),
            type: d.isUser ? 'user' : d.isGroup ? 'chat' : 'channel',
            unreadCount: Number(d.unreadCount || 0),
            lastMessage: d.message?.message ? String(d.message.message) : null,
            isPinned: false,
          })
        );
        s.cache.lastSync = Date.now();
        result = s.cache.dialogs;
        break;

      case 'send-message':
        if (!s.client) throw new Error('Client not connected');
        if (!s.config.isAuthenticated) throw new Error('Not authenticated');
        const sentMessage = await s.client.sendMessage(args.peer, { message: args.message });
        result = { id: sentMessage.id, date: sentMessage.date, message: sentMessage.message };
        break;

      case 'get-messages':
        if (!s.client) throw new Error('Client not connected');
        if (!s.config.isAuthenticated) throw new Error('Not authenticated');
        const messages = await s.client.getMessages(args.peer, { limit: args.limit || 20 });
        result = messages.map(
          (m: {
            id: unknown;
            date: unknown;
            message: unknown;
            fromId: { userId: { toString: () => unknown } } | null;
          }) => ({
            id: m.id,
            date: m.date,
            message: m.message,
            fromId: m.fromId?.userId?.toString() || null,
          })
        );
        break;

      default:
        throw new Error(`Unknown request type: ${type}`);
    }

    updateRequest(id, 'complete', result);
    console.log(`[telegram] Request ${id} completed`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    updateRequest(id, 'error', undefined, errorMsg);
    console.error(`[telegram] Request ${id} failed:`, e);
  }

  publishState();
}

async function processRequestQueue(): Promise<void> {
  const pending = getPendingRequests();
  if (pending.length === 0) return;

  for (const request of pending) {
    await processRequest(request);
  }

  // Clean old requests periodically
  cleanOldRequests();
}

// ---------------------------------------------------------------------------
// Worker Loop (setTimeout-based)
// ---------------------------------------------------------------------------

function startWorkerLoop(): void {
  const s = globalThis.getSkillState();
  if (s.workerRunning) {
    console.log('[telegram] Worker loop already running');
    return;
  }

  s.workerRunning = true;
  console.log('[telegram] Starting worker loop');

  function tick(): void {
    const st = globalThis.getSkillState();
    if (!st.workerRunning) {
      console.log('[telegram] Worker loop stopped');
      return;
    }

    // Process any pending requests
    processRequestQueue()
      .catch(e => {
        console.error('[telegram] Queue processing error:', e);
      })
      .finally(() => {
        // Schedule next tick if still running
        const state = globalThis.getSkillState();
        if (state.workerRunning) {
          state.workerTimeoutId = setTimeout(tick, WORKER_INTERVAL_MS);
        }
      });
  }

  // Start the first tick
  s.workerTimeoutId = setTimeout(tick, 0);
}

function stopWorkerLoop(): void {
  const s = globalThis.getSkillState();
  console.log('[telegram] Stopping worker loop');
  s.workerRunning = false;

  if (s.workerTimeoutId !== null) {
    clearTimeout(s.workerTimeoutId);
    s.workerTimeoutId = null;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle Hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log('[telegram] Initializing skill');

  // Check runtime capabilities
  console.log(`[telegram] WebSocket available: ${typeof WebSocket !== 'undefined'}`);
  console.log(`[telegram] GramJS available: ${typeof GramJS !== 'undefined'}`);
  console.log(`[telegram] setTimeout available: ${typeof setTimeout !== 'undefined'}`);

  // Create database tables
  db.exec(SCHEMA, []);

  // Load config from store
  const s = globalThis.getSkillState();
  const saved = store.get('config') as Partial<typeof s.config> | null;
  if (saved) {
    s.config.apiId = saved.apiId || 0;
    s.config.apiHash = saved.apiHash || '';
    s.config.phoneNumber = saved.phoneNumber || '';
    s.config.isAuthenticated = saved.isAuthenticated || false;
    s.config.sessionString = saved.sessionString || '';
    s.config.phoneCodeHash = saved.phoneCodeHash || '';
    s.config.pendingCode = saved.pendingCode || false;
  }

  // Load from environment if not in store
  if (!s.config.apiId) {
    const envApiId = platform.env('TELEGRAM_API_ID');
    if (envApiId) {
      s.config.apiId = parseInt(envApiId, 10);
    }
  }
  if (!s.config.apiHash) {
    s.config.apiHash = platform.env('TELEGRAM_API_HASH') || '';
  }

  console.log(
    `[telegram] Config loaded — apiId: ${s.config.apiId ? 'set' : 'not set'}, apiHash: ${s.config.apiHash ? 'set' : 'not set'}`
  );
  console.log(
    `[telegram] Session: ${s.config.sessionString ? 'present' : 'not present'}, authenticated: ${s.config.isAuthenticated}`
  );

  // Start the worker loop immediately so requests can be processed during setup
  startWorkerLoop();

  // Test connectivity on init if we have credentials (even without a session)
  // This helps diagnose connection issues early
  if (s.config.apiId && s.config.apiHash) {
    console.log('[telegram] Credentials available, testing connectivity on init...');
    testConnectivity();
  } else {
    console.log('[telegram] No credentials available yet, skipping connectivity test');
  }

  publishState();
}

// Separate async function for connectivity test (can't use async in init directly)
function testConnectivity(): void {
  // Use setTimeout to run async test without blocking init
  setTimeout(async () => {
    const s = globalThis.getSkillState();
    try {
      console.log('[telegram] Starting connectivity test...');
      const stringSession = new GramJS.StringSession(s.config.sessionString || '');
      const testClient = new TelegramClient(stringSession, s.config.apiId, s.config.apiHash, {
        connectionRetries: 3,
      });

      console.log('[telegram] Connecting to Telegram for connectivity test...');
      await testClient.connect();
      console.log('[telegram] Connected to Telegram successfully');

      // Test with help.getAppConfig (no auth required)
      console.log('[telegram] Calling help.getAppConfig...');
      const appConfig = await testClient.invoke(new GramJS.Api.help.GetAppConfig({ hash: 0 }));
      console.log('[telegram] help.getAppConfig succeeded!');

      if (appConfig && typeof appConfig === 'object') {
        console.log(
          '[telegram] App config className:',
          (appConfig as { className?: string }).className || 'AppConfig'
        );
      }

      // If this test client connected, check if we should keep it or dispose
      // If we have a session, we'll use it as the main client
      if (s.config.sessionString) {
        // We have a session, so this test client can become the main client
        s.client = testClient;
        s.clientError = null;

        // Check authorization
        const authorized = await testClient.checkAuthorization();
        console.log('[telegram] Authorization status:', authorized ? 'authorized' : 'not authorized');

        if (authorized) {
          s.config.isAuthenticated = true;
          await loadMe();
        }
      } else {
        // No session, disconnect the test client
        console.log('[telegram] No session, disconnecting test client');
        await testClient.disconnect();
      }

      publishState();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[telegram] Connectivity test failed:', errorMsg);
      s.clientError = `Connectivity test failed: ${errorMsg}`;
      publishState();
    }
  }, 0);
}

function start(): void {
  console.log('[telegram] Starting skill');
  const s = globalThis.getSkillState();

  // Ensure worker loop is running (it may already be running from init)
  if (!s.workerRunning) {
    startWorkerLoop();
  }
}

function stop(): void {
  console.log('[telegram] Stopping skill');
  const s = globalThis.getSkillState();

  // Stop the worker loop
  stopWorkerLoop();

  // Disconnect client
  if (s.client) {
    try {
      s.client.disconnect();
    } catch (e) {
      console.warn('[telegram] Error disconnecting:', e);
    }
    s.client = null;
  }

  // Save config
  store.set('config', s.config);

  state.set('status', 'stopped');
}

// onCronTrigger is kept for compatibility but worker loop handles processing now
function onCronTrigger(_scheduleId: string): void {
  // No-op: worker loop handles request processing via setTimeout
}

// ---------------------------------------------------------------------------
// Setup Flow
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  const envApiId = platform.env('TELEGRAM_API_ID');
  const envApiHash = platform.env('TELEGRAM_API_HASH');
  console.log(`[telegram] onSetupStart: envApiId: ${envApiId}, envApiHash: ${envApiHash}`);

  if (envApiId && envApiHash) {
    return {
      step: {
        id: 'phone',
        title: 'Connect Telegram Account',
        description: 'Enter your phone number to connect your Telegram account.',
        fields: [
          {
            name: 'phoneNumber',
            type: 'text',
            label: 'Phone Number',
            description: 'International format (e.g., +1234567890)',
            required: true,
            placeholder: '+1234567890',
          },
        ],
      },
    };
  }

  return {
    step: {
      id: 'credentials',
      title: 'Telegram API Credentials',
      description:
        'Enter your Telegram API credentials from my.telegram.org. ' +
        'Then you will enter your phone number.',
      fields: [
        {
          name: 'apiId',
          type: 'text',
          label: 'API ID',
          description: 'Your Telegram API ID (numeric)',
          required: true,
          placeholder: '12345678',
        },
        {
          name: 'apiHash',
          type: 'password',
          label: 'API Hash',
          description: 'Your Telegram API Hash',
          required: true,
          placeholder: 'abc123...',
        },
      ],
    },
  };
}

function onSetupSubmit(args: SetupSubmitArgs): SetupSubmitResult {
  const s = globalThis.getSkillState();
  const { stepId, values } = args;

  if (stepId === 'credentials') {
    const apiId = parseInt((values.apiId as string) || '', 10);
    const apiHash = ((values.apiHash as string) || '').trim();

    console.log(
      `[telegram] Setup: credentials step - apiId: ${apiId}, apiHash: ${apiHash ? '[set]' : '[empty]'}`
    );

    if (!apiId || isNaN(apiId)) {
      return { status: 'error', errors: [{ field: 'apiId', message: 'Valid API ID is required' }] };
    }
    if (!apiHash) {
      return { status: 'error', errors: [{ field: 'apiHash', message: 'API Hash is required' }] };
    }

    s.config.apiId = apiId;
    s.config.apiHash = apiHash;
    store.set('config', s.config);

    // Queue connect request
    const connectRequestId = enqueueRequest('connect', {});
    console.log(`[telegram] Setup: enqueued connect request: ${connectRequestId}`);

    return {
      status: 'next',
      nextStep: {
        id: 'phone',
        title: 'Connect Telegram Account',
        description:
          'Enter your phone number to connect your Telegram account. Please wait a moment for the connection to establish.',
        fields: [
          {
            name: 'phoneNumber',
            type: 'text',
            label: 'Phone Number',
            description: 'International format (e.g., +1234567890)',
            required: true,
            placeholder: '+1234567890',
          },
        ],
      },
    };
  }

  if (stepId === 'phone') {
    const phoneNumber = ((values.phoneNumber as string) || '').trim();

    console.log(
      `[telegram] Setup: phone step - number: ${phoneNumber ? phoneNumber.slice(0, 4) + '****' : '[empty]'}`
    );
    console.log(
      `[telegram] Setup: CLIENT connected: ${s.client !== null}, connecting: ${s.clientConnecting}, error: ${s.clientError}`
    );

    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return {
        status: 'error',
        errors: [
          {
            field: 'phoneNumber',
            message: 'Phone number must start with + (international format)',
          },
        ],
      };
    }

    // Check if we're connected before trying to send code
    if (!s.client && !s.clientConnecting) {
      console.log('[telegram] Setup: Client not connected, re-queuing connect request');
      enqueueRequest('connect', {});
    }

    // Queue send-code request
    const sendCodeRequestId = enqueueRequest('send-code', { phoneNumber });
    console.log(`[telegram] Setup: enqueued send-code request: ${sendCodeRequestId}`);

    return {
      status: 'next',
      nextStep: {
        id: 'code',
        title: 'Enter Verification Code',
        description:
          'A verification code has been requested. Check your Telegram app or SMS. It may take a few seconds to arrive.',
        fields: [
          {
            name: 'code',
            type: 'text',
            label: 'Verification Code',
            description: '5-digit code from Telegram',
            required: true,
            placeholder: '12345',
          },
        ],
      },
    };
  }

  if (stepId === 'code') {
    const code = ((values.code as string) || '').trim();

    if (!code) {
      return {
        status: 'error',
        errors: [{ field: 'code', message: 'Verification code is required' }],
      };
    }

    // todo: sign in

    // Note: In a real implementation, we'd wait for the sign-in to complete
    // For now, we mark setup as complete and let the async process handle it
    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
}

function onSetupCancel(): void {
  console.log('[telegram] Setup cancelled');
}

function publishState(): void {
  const s = globalThis.getTelegramSkillState();
  state.setPartial({
    connected: s.client !== null,
    connecting: s.clientConnecting,
    authenticated: s.config.isAuthenticated,
    pendingCode: s.config.pendingCode,
    phoneNumber: s.config.phoneNumber ? s.config.phoneNumber.slice(0, 4) + '****' : null,
    hasCredentials: !!(s.config.apiId && s.config.apiHash),
    me: s.cache.me,
    dialogCount: s.cache.dialogs.length,
    lastSync: s.cache.lastSync,
    error: s.clientError,
  });
}

// ---------------------------------------------------------------------------
// Exports to globalThis (required for V8 runtime)
// ---------------------------------------------------------------------------

const skill: Skill = {
  info: {
    id: 'telegram',
    name: 'Telegram',
    runtime: 'v8',
    entry: 'index.js',
    version: '1.0.0',
    description: 'Telegram integration',
    auto_start: false,
    setup: { required: true, label: 'Configure Telegram' },
  },
  tools: [],
  init,
  start,
  stop,
  onCronTrigger,
  onSetupStart,
  onSetupSubmit,
  onSetupCancel,
};

export default skill;

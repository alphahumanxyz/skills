// telegram/index.ts
// Telegram integration skill using gramjs library via V8 runtime.
// Provides tools for Telegram API access with async request queue pattern.

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
// Types
// ---------------------------------------------------------------------------

interface SkillConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  isAuthenticated: boolean;
  sessionString: string;
  phoneCodeHash: string;
  pendingCode: boolean;
}

interface TelegramRequest {
  id: string;
  type: string;
  args: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  result: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

interface FormattedUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  isBot?: boolean;
  isPremium?: boolean;
}

interface FormattedDialog {
  id: string;
  title: string;
  type: 'user' | 'chat' | 'channel';
  unreadCount: number;
  lastMessage: string | null;
  isPinned: boolean;
}

interface Cache {
  me: FormattedUser | null;
  dialogs: FormattedDialog[];
  lastSync: number;
}

interface SetupSubmitArgs {
  stepId: string;
  values: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const CONFIG: SkillConfig = {
  apiId: 0,
  apiHash: '',
  phoneNumber: '',
  isAuthenticated: false,
  sessionString: '',
  phoneCodeHash: '',
  pendingCode: false,
};

const CACHE: Cache = { me: null, dialogs: [], lastSync: 0 };

let CLIENT: InstanceType<typeof GramJS.TelegramClient> | null = null;
let CLIENT_CONNECTING = false;
let CLIENT_ERROR: string | null = null;

// Worker loop state
let WORKER_RUNNING = false;
let WORKER_TIMEOUT_ID: ReturnType<typeof setTimeout> | null = null;
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
// Utility Functions
// ---------------------------------------------------------------------------

function generateId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function enqueueRequest(type: string, args: Record<string, unknown>): string {
  const id = generateId();
  const now = Date.now();
  db.exec(
    'INSERT INTO telegram_requests (id, type, args, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, type, JSON.stringify(args), 'pending', now]
  );
  return id;
}

function getRequest(id: string): TelegramRequest | null {
  return db.get('SELECT * FROM telegram_requests WHERE id = ?', [id]) as TelegramRequest | null;
}

function updateRequest(id: string, status: string, result?: unknown, error?: string): void {
  const now = Date.now();
  if (error) {
    db.exec('UPDATE telegram_requests SET status = ?, error = ?, completed_at = ? WHERE id = ?', [
      status,
      error,
      now,
      id,
    ]);
  } else {
    db.exec('UPDATE telegram_requests SET status = ?, result = ?, completed_at = ? WHERE id = ?', [
      status,
      result ? JSON.stringify(result) : null,
      now,
      id,
    ]);
  }
}

function getPendingRequests(): TelegramRequest[] {
  const rows = db.all(
    'SELECT * FROM telegram_requests WHERE status = ? ORDER BY created_at ASC LIMIT 10',
    ['pending']
  );
  return rows as unknown as TelegramRequest[];
}

function cleanOldRequests(): void {
  // Clean requests older than 1 hour
  const cutoff = Date.now() - 3600000;
  db.exec('DELETE FROM telegram_requests WHERE created_at < ?', [cutoff]);
}

// ---------------------------------------------------------------------------
// Client Management
// ---------------------------------------------------------------------------

async function initClient(): Promise<void> {
  if (CLIENT || CLIENT_CONNECTING) {
    console.log(
      `[telegram] initClient skipped: CLIENT=${CLIENT !== null}, CONNECTING=${CLIENT_CONNECTING}`
    );
    return;
  }
  if (!CONFIG.apiId || !CONFIG.apiHash) {
    console.log('[telegram] Cannot init client: missing credentials');
    return;
  }

  CLIENT_CONNECTING = true;
  CLIENT_ERROR = null;

  try {
    console.log('[telegram] Initializing TelegramClient...');
    console.log(
      `[telegram] API ID: ${CONFIG.apiId}, API Hash: ${CONFIG.apiHash ? '[set]' : '[empty]'}`
    );
    console.log(`[telegram] WebSocket available: ${typeof WebSocket !== 'undefined'}`);
    console.log(`[telegram] GramJS available: ${typeof GramJS !== 'undefined'}`);

    // Use StringSession if we have a saved session
    console.log('[telegram] Creating StringSession...');
    const session = new GramJS.StringSession(CONFIG.sessionString || '');
    console.log('[telegram] StringSession created');

    console.log('[telegram] Creating TelegramClient...');
    CLIENT = new GramJS.TelegramClient(session, CONFIG.apiId, CONFIG.apiHash, {
      connectionRetries: 5,
      useWSS: true,
      // Use WebSocket transport for browser-like environment
    });
    console.log('[telegram] TelegramClient created, connecting...');

    await CLIENT.connect();
    console.log('[telegram] Connected to Telegram servers');

    // Check if authorized
    const authorized = await CLIENT.checkAuthorization();
    console.log(`[telegram] Authorization check: ${authorized}`);
    if (authorized) {
      CONFIG.isAuthenticated = true;
      // Save session string
      const sessionString = CLIENT.session.save();
      if (sessionString) {
        CONFIG.sessionString = sessionString;
        store.set('config', CONFIG);
      }
      // Get user info
      await loadMe();
    }

    CLIENT_CONNECTING = false;
    console.log('[telegram] Client initialization complete');
    publishState();
  } catch (e) {
    CLIENT_ERROR = String(e);
    CLIENT = null;
    CLIENT_CONNECTING = false;
    console.error('[telegram] Failed to init client:', e);
    if (e instanceof Error && e.stack) {
      console.error('[telegram] Stack trace:', e.stack);
    }
    publishState();
  }
}

async function loadMe(): Promise<void> {
  if (!CLIENT) return;
  try {
    const me = await CLIENT.getMe();
    if (me) {
      CACHE.me = {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        phoneNumber: me.phone,
        isBot: me.bot,
        isPremium: me.premium,
      };
      CACHE.lastSync = Date.now();
    }
  } catch (e) {
    console.error('[telegram] Failed to load me:', e);
  }
}

// ---------------------------------------------------------------------------
// Request Processing
// ---------------------------------------------------------------------------

async function processRequest(request: TelegramRequest): Promise<void> {
  const { id, type, args: argsStr } = request;
  const args = JSON.parse(argsStr);

  console.log(`[telegram] Processing request ${id}: ${type}`);
  updateRequest(id, 'processing');

  try {
    let result: unknown;

    switch (type) {
      case 'connect':
        await initClient();
        result = { connected: CLIENT !== null, error: CLIENT_ERROR };
        break;

      case 'send-code':
        if (!CLIENT) throw new Error('Client not connected');
        const sendCodeResult = await CLIENT.sendCode(
          { apiId: CONFIG.apiId, apiHash: CONFIG.apiHash },
          args.phoneNumber
        );
        CONFIG.phoneCodeHash = sendCodeResult.phoneCodeHash;
        CONFIG.phoneNumber = args.phoneNumber;
        CONFIG.pendingCode = true;
        store.set('config', CONFIG);
        result = {
          phoneCodeHash: sendCodeResult.phoneCodeHash,
          isCodeViaApp: sendCodeResult.isCodeViaApp,
        };
        break;

      case 'sign-in':
        if (!CLIENT) throw new Error('Client not connected');
        if (!CONFIG.phoneCodeHash) throw new Error('No pending code');
        await CLIENT.invoke(
          new GramJS.Api.auth.SignIn({
            phoneNumber: CONFIG.phoneNumber,
            phoneCodeHash: CONFIG.phoneCodeHash,
            phoneCode: args.code,
          })
        );
        CONFIG.isAuthenticated = true;
        CONFIG.pendingCode = false;
        const sessionStr = CLIENT.session.save();
        if (sessionStr) {
          CONFIG.sessionString = sessionStr;
        }
        store.set('config', CONFIG);
        await loadMe();
        result = { success: true, user: CACHE.me };
        break;

      case 'get-me':
        if (!CLIENT) throw new Error('Client not connected');
        if (!CONFIG.isAuthenticated) throw new Error('Not authenticated');
        await loadMe();
        result = CACHE.me;
        break;

      case 'get-dialogs':
        if (!CLIENT) throw new Error('Client not connected');
        if (!CONFIG.isAuthenticated) throw new Error('Not authenticated');
        const dialogs = await CLIENT.getDialogs({ limit: args.limit || 20 });
        CACHE.dialogs = dialogs.map(
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
        CACHE.lastSync = Date.now();
        result = CACHE.dialogs;
        break;

      case 'send-message':
        if (!CLIENT) throw new Error('Client not connected');
        if (!CONFIG.isAuthenticated) throw new Error('Not authenticated');
        const sentMessage = await CLIENT.sendMessage(args.peer, { message: args.message });
        result = { id: sentMessage.id, date: sentMessage.date, message: sentMessage.message };
        break;

      case 'get-messages':
        if (!CLIENT) throw new Error('Client not connected');
        if (!CONFIG.isAuthenticated) throw new Error('Not authenticated');
        const messages = await CLIENT.getMessages(args.peer, { limit: args.limit || 20 });
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
  if (WORKER_RUNNING) {
    console.log('[telegram] Worker loop already running');
    return;
  }

  WORKER_RUNNING = true;
  console.log('[telegram] Starting worker loop');

  function tick(): void {
    if (!WORKER_RUNNING) {
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
        if (WORKER_RUNNING) {
          WORKER_TIMEOUT_ID = setTimeout(tick, WORKER_INTERVAL_MS);
        }
      });
  }

  // Start the first tick
  WORKER_TIMEOUT_ID = setTimeout(tick, 0);
}

function stopWorkerLoop(): void {
  console.log('[telegram] Stopping worker loop');
  WORKER_RUNNING = false;

  if (WORKER_TIMEOUT_ID !== null) {
    clearTimeout(WORKER_TIMEOUT_ID);
    WORKER_TIMEOUT_ID = null;
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
  const saved = store.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    CONFIG.apiId = saved.apiId || 0;
    CONFIG.apiHash = saved.apiHash || '';
    CONFIG.phoneNumber = saved.phoneNumber || '';
    CONFIG.isAuthenticated = saved.isAuthenticated || false;
    CONFIG.sessionString = saved.sessionString || '';
    CONFIG.phoneCodeHash = saved.phoneCodeHash || '';
    CONFIG.pendingCode = saved.pendingCode || false;
  }

  // Load from environment if not in store
  if (!CONFIG.apiId) {
    const envApiId = platform.env('TELEGRAM_API_ID');
    if (envApiId) {
      CONFIG.apiId = parseInt(envApiId, 10);
    }
  }
  if (!CONFIG.apiHash) {
    CONFIG.apiHash = platform.env('TELEGRAM_API_HASH') || '';
  }

  // Start the worker loop immediately so requests can be processed during setup
  startWorkerLoop();

  console.log(`[telegram] Config loaded — authenticated: ${CONFIG.isAuthenticated}`);
  publishState();
}

function start(): void {
  console.log('[telegram] Starting skill');

  // Ensure worker loop is running (it may already be running from init)
  if (!WORKER_RUNNING) {
    startWorkerLoop();
  }

  // Auto-connect if we have credentials and session
  if (CONFIG.apiId && CONFIG.apiHash && CONFIG.sessionString) {
    enqueueRequest('connect', {});
  }

  publishState();
}

function stop(): void {
  console.log('[telegram] Stopping skill');

  // Stop the worker loop
  stopWorkerLoop();

  // Disconnect client
  if (CLIENT) {
    try {
      CLIENT.disconnect();
    } catch (e) {
      console.warn('[telegram] Error disconnecting:', e);
    }
    CLIENT = null;
  }

  // Save config
  store.set('config', CONFIG);

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

    CONFIG.apiId = apiId;
    CONFIG.apiHash = apiHash;
    store.set('config', CONFIG);

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
      `[telegram] Setup: CLIENT connected: ${CLIENT !== null}, connecting: ${CLIENT_CONNECTING}, error: ${CLIENT_ERROR}`
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
    if (!CLIENT && !CLIENT_CONNECTING) {
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

    // Queue sign-in request
    enqueueRequest('sign-in', { code });

    // Note: In a real implementation, we'd wait for the sign-in to complete
    // For now, we mark setup as complete and let the async process handle it
    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
}

function onSetupCancel(): void {
  console.log('[telegram] Setup cancelled');
}

// ---------------------------------------------------------------------------
// State Publishing
// ---------------------------------------------------------------------------

function publishState(): void {
  state.setPartial({
    connected: CLIENT !== null,
    connecting: CLIENT_CONNECTING,
    authenticated: CONFIG.isAuthenticated,
    pendingCode: CONFIG.pendingCode,
    phoneNumber: CONFIG.phoneNumber ? CONFIG.phoneNumber.slice(0, 4) + '****' : null,
    hasCredentials: !!(CONFIG.apiId && CONFIG.apiHash),
    me: CACHE.me,
    dialogCount: CACHE.dialogs.length,
    lastSync: CACHE.lastSync,
    error: CLIENT_ERROR,
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

tools = [
  // =========================================================================
  // CONNECTION & AUTH
  // =========================================================================
  {
    name: 'telegram-connect',
    description:
      'Connect to Telegram servers. This is an async operation - returns a request ID. ' +
      'Use telegram-get-result to check the status.',
    input_schema: { type: 'object', properties: {} },
    execute(): string {
      if (!CONFIG.apiId || !CONFIG.apiHash) {
        return JSON.stringify({ error: 'API credentials not configured. Complete setup first.' });
      }
      const requestId = enqueueRequest('connect', {});
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  {
    name: 'telegram-send-code',
    description:
      'Send a verification code to the specified phone number. ' +
      'Returns a request ID - use telegram-get-result to check status.',
    input_schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Phone number in international format (e.g., +1234567890)',
        },
      },
      required: ['phone_number'],
    },
    execute(args: Record<string, unknown>): string {
      const phoneNumber = args.phone_number as string;
      if (!phoneNumber || !phoneNumber.startsWith('+')) {
        return JSON.stringify({ error: 'Phone number must be in international format (+...)' });
      }
      const requestId = enqueueRequest('send-code', { phoneNumber });
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  {
    name: 'telegram-sign-in',
    description:
      'Sign in with the verification code received after calling telegram-send-code. ' +
      'Returns a request ID - use telegram-get-result to check status.',
    input_schema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Verification code from Telegram' } },
      required: ['code'],
    },
    execute(args: Record<string, unknown>): string {
      const code = args.code as string;
      if (!code) {
        return JSON.stringify({ error: 'Verification code is required' });
      }
      const requestId = enqueueRequest('sign-in', { code });
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  // =========================================================================
  // STATUS & RESULTS
  // =========================================================================
  {
    name: 'telegram-status',
    description: 'Get the current connection and authentication status.',
    input_schema: { type: 'object', properties: {} },
    execute(): string {
      return JSON.stringify({
        connected: CLIENT !== null,
        connecting: CLIENT_CONNECTING,
        authenticated: CONFIG.isAuthenticated,
        pendingCode: CONFIG.pendingCode,
        hasCredentials: !!(CONFIG.apiId && CONFIG.apiHash),
        me: CACHE.me,
        dialogCount: CACHE.dialogs.length,
        lastSync: CACHE.lastSync,
        error: CLIENT_ERROR,
      });
    },
  },

  {
    name: 'telegram-get-result',
    description:
      'Get the result of an async Telegram operation by request ID. ' +
      'Returns the status and result/error of the operation.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'The request ID returned by an async operation',
        },
      },
      required: ['request_id'],
    },
    execute(args: Record<string, unknown>): string {
      const requestId = args.request_id as string;
      const request = getRequest(requestId);
      if (!request) {
        return JSON.stringify({ error: 'Request not found', requestId });
      }
      return JSON.stringify({
        requestId: request.id,
        type: request.type,
        status: request.status,
        result: request.result ? JSON.parse(request.result) : null,
        error: request.error,
        createdAt: request.created_at,
        completedAt: request.completed_at,
      });
    },
  },

  // =========================================================================
  // MESSAGING
  // =========================================================================
  {
    name: 'telegram-get-me',
    description: 'Get information about the authenticated user.',
    input_schema: { type: 'object', properties: {} },
    execute(): string {
      if (!CONFIG.isAuthenticated) {
        return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
      }
      if (CACHE.me) {
        return JSON.stringify(CACHE.me);
      }
      const requestId = enqueueRequest('get-me', {});
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  {
    name: 'telegram-get-dialogs',
    description:
      'Get the list of dialogs (chats, channels, users). ' +
      'Returns a request ID - use telegram-get-result to check status.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of dialogs to return (default: 20)' },
      },
    },
    execute(args: Record<string, unknown>): string {
      if (!CONFIG.isAuthenticated) {
        return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
      }
      const limit = (args.limit as number) || 20;
      const requestId = enqueueRequest('get-dialogs', { limit });
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  {
    name: 'telegram-send-message',
    description:
      'Send a message to a user, chat, or channel. ' +
      'Returns a request ID - use telegram-get-result to check status.',
    input_schema: {
      type: 'object',
      properties: {
        peer: { type: 'string', description: 'Username, phone number, or ID of the recipient' },
        message: { type: 'string', description: 'The message text to send' },
      },
      required: ['peer', 'message'],
    },
    execute(args: Record<string, unknown>): string {
      if (!CONFIG.isAuthenticated) {
        return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
      }
      const peer = args.peer as string;
      const message = args.message as string;
      if (!peer || !message) {
        return JSON.stringify({ error: 'Both peer and message are required' });
      }
      const requestId = enqueueRequest('send-message', { peer, message });
      return JSON.stringify({ status: 'pending', requestId });
    },
  },

  {
    name: 'telegram-get-messages',
    description:
      'Get messages from a chat. ' +
      'Returns a request ID - use telegram-get-result to check status.',
    input_schema: {
      type: 'object',
      properties: {
        peer: { type: 'string', description: 'Username, phone number, or ID of the chat' },
        limit: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 20)',
        },
      },
      required: ['peer'],
    },
    execute(args: Record<string, unknown>): string {
      if (!CONFIG.isAuthenticated) {
        return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
      }
      const peer = args.peer as string;
      const limit = (args.limit as number) || 20;
      if (!peer) {
        return JSON.stringify({ error: 'Peer is required' });
      }
      const requestId = enqueueRequest('get-messages', { peer, limit });
      return JSON.stringify({ status: 'pending', requestId });
    },
  },
];

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
  tools,
  init,
  start,
  stop,
  onCronTrigger,
  onSetupStart,
  onSetupSubmit,
  onSetupCancel,
};

export default skill;

// Import all tools
import { getPingHistoryTool } from './tools/get-ping-history';
import { getPingStatsTool } from './tools/get-ping-stats';
import { listPeerSkillsTool } from './tools/list-peer-skills';
import { pingNowTool } from './tools/ping-now';
import { readConfigTool } from './tools/read-config';
import { updateServerUrlTool } from './tools/update-server-url';

// server-ping/index.ts
// Comprehensive demo skill showcasing all V8 runtime capabilities:
//   Setup flow, DB (SQLite), Store (KV), State (frontend pub), Data (file I/O),
//   Net (HTTP), Cron (scheduling), Platform (OS/notify), Skills (interop),
//   Options, Tools, and Session lifecycle.

// ---------------------------------------------------------------------------
// Configuration (populated by setup flow, persisted in store)
// ---------------------------------------------------------------------------

interface SkillConfig {
  serverUrl: string;
  pingIntervalSec: number;
  notifyOnDown: boolean;
  notifyOnRecover: boolean;
  verboseLogging: boolean;
}

const CONFIG: SkillConfig = {
  serverUrl: '',
  pingIntervalSec: 10,
  notifyOnDown: true,
  notifyOnRecover: true,
  verboseLogging: false,
};

let PING_COUNT = 0;
let FAIL_COUNT = 0;
let CONSECUTIVE_FAILS = 0;
let WAS_DOWN = false;
let ACTIVE_SESSIONS: string[] = [];

// Expose shared state to globalThis for bundled tool modules that use `declare const`
// This is needed because esbuild bundles tool files in separate CommonJS modules
// and they reference these variables as globals via ambient TypeScript declarations
const _g = globalThis as Record<string, unknown>;
_g.CONFIG = CONFIG;
_g.PING_COUNT = PING_COUNT;
_g.FAIL_COUNT = FAIL_COUNT;
_g.CONSECUTIVE_FAILS = CONSECUTIVE_FAILS;

// Helper to sync mutable state to globalThis after changes
function _syncState(): void {
  _g.PING_COUNT = PING_COUNT;
  _g.FAIL_COUNT = FAIL_COUNT;
  _g.CONSECUTIVE_FAILS = CONSECUTIVE_FAILS;
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log(`[server-ping] Initializing on ${platform.os()}`);

  // Create DB table for ping history
  db.exec(
    `CREATE TABLE IF NOT EXISTS ping_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER,
      latency_ms INTEGER,
      success INTEGER NOT NULL,
      error TEXT
    )`,
    []
  );

  // Load persisted config from store
  const saved = store.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    CONFIG.serverUrl = saved.serverUrl ?? CONFIG.serverUrl;
    CONFIG.pingIntervalSec = saved.pingIntervalSec ?? CONFIG.pingIntervalSec;
    CONFIG.notifyOnDown = saved.notifyOnDown ?? CONFIG.notifyOnDown;
    CONFIG.notifyOnRecover = saved.notifyOnRecover ?? CONFIG.notifyOnRecover;
    CONFIG.verboseLogging = saved.verboseLogging ?? CONFIG.verboseLogging;
  }

  // Fall back to the host's backend URL if no server URL is configured yet
  if (!CONFIG.serverUrl) {
    // Try both BACKEND_URL and VITE_BACKEND_URL (Vite uses VITE_ prefix)
    const envUrl = platform.env('BACKEND_URL') || platform.env('VITE_BACKEND_URL');
    if (envUrl) {
      CONFIG.serverUrl = envUrl;
      console.log(`[server-ping] Using BACKEND_URL from env: ${envUrl}`);
    }
  }

  // Load counters from store
  const counters = store.get('counters') as { pingCount?: number; failCount?: number } | null;
  if (counters) {
    PING_COUNT = counters.pingCount ?? 0;
    FAIL_COUNT = counters.failCount ?? 0;
  }

  console.log(`[server-ping] Config loaded — target: ${CONFIG.serverUrl}`);
}

function start(): void {
  if (!CONFIG.serverUrl) {
    console.warn('[server-ping] No server URL configured — waiting for setup');
    return;
  }

  const cronExpr = `*/${CONFIG.pingIntervalSec} * * * * *`;
  console.log(`[server-ping] Starting — ping every ${CONFIG.pingIntervalSec}s (${cronExpr})`);
  cron.register('ping', cronExpr);

  // Publish initial state to frontend
  publishState();
}

function stop(): void {
  console.log('[server-ping] Stopping');
  cron.unregister('ping');

  // Persist counters
  store.set('counters', { pingCount: PING_COUNT, failCount: FAIL_COUNT });

  state.set('status', 'stopped');
}

// ---------------------------------------------------------------------------
// Setup flow (multi-step)
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  console.log("[server-ping] onSetupStart");
  // Pre-fill with the host's backend URL so the user doesn't have to type it
  const defaultUrl = platform.env('BACKEND_URL') || platform.env('VITE_BACKEND_URL') || '';

  return {
    step: {
      id: 'server-config',
      title: 'Server Configuration',
      description: 'Enter the server URL to monitor and choose a ping interval.',
      fields: [
        {
          name: 'serverUrl',
          type: 'text',
          label: 'Server URL',
          description: 'Full URL to ping (e.g. https://api.example.com/health)',
          required: true,
          default: defaultUrl,
          placeholder: 'https://api.example.com/health',
        },
        {
          name: 'pingIntervalSec',
          type: 'select',
          label: 'Ping Interval',
          description: 'How often to check the server',
          required: true,
          default: '10',
          options: [
            { label: 'Every 5 seconds', value: '5' },
            { label: 'Every 10 seconds', value: '10' },
            { label: 'Every 30 seconds', value: '30' },
            { label: 'Every 60 seconds', value: '60' },
          ],
        },
      ],
    },
  };
}

function onSetupSubmit(args: {
  stepId: string;
  values: Record<string, unknown>;
}): SetupSubmitResult {
  const { stepId, values } = args;

  if (stepId === 'server-config') {
    // Validate URL
    const url = ((values.serverUrl as string) ?? '').trim();
    if (!url) {
      return {
        status: 'error',
        errors: [{ field: 'serverUrl', message: 'Server URL is required' }],
      };
    }
    if (!url.startsWith('http')) {
      return {
        status: 'error',
        errors: [{ field: 'serverUrl', message: 'URL must start with http:// or https://' }],
      };
    }

    // Store values and move to next step
    CONFIG.serverUrl = url;
    CONFIG.pingIntervalSec = parseInt(values.pingIntervalSec as string) || 10;

    return {
      status: 'next',
      nextStep: {
        id: 'notification-config',
        title: 'Notification Preferences',
        description: 'Choose when to receive desktop notifications.',
        fields: [
          {
            name: 'notifyOnDown',
            type: 'boolean',
            label: 'Notify when server goes down',
            description: 'Send a desktop notification when the server becomes unreachable',
            required: false,
            default: true,
          },
          {
            name: 'notifyOnRecover',
            type: 'boolean',
            label: 'Notify when server recovers',
            description: 'Send a desktop notification when the server comes back online',
            required: false,
            default: true,
          },
        ],
      },
    };
  }

  if (stepId === 'notification-config') {
    CONFIG.notifyOnDown = (values.notifyOnDown as boolean) ?? true;
    CONFIG.notifyOnRecover = (values.notifyOnRecover as boolean) ?? true;

    // Persist full config to store
    store.set('config', CONFIG);

    // Write a human-readable config file to data dir
    data.write('config.json', JSON.stringify(CONFIG, null, 2));

    console.log(`[server-ping] Setup complete — monitoring ${CONFIG.serverUrl}`);

    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
}

function onSetupCancel(): void {
  console.log('[server-ping] Setup cancelled');
}

// ---------------------------------------------------------------------------
// Options (runtime-configurable)
// ---------------------------------------------------------------------------

function onListOptions(): { options: SkillOption[] } {
  return {
    options: [
      {
        name: 'pingIntervalSec',
        type: 'select',
        label: 'Ping interval',
        description: 'How often to check the server',
        value: String(CONFIG.pingIntervalSec),
        options: [
          { label: 'Every 5 seconds', value: '5' },
          { label: 'Every 10 seconds', value: '10' },
          { label: 'Every 30 seconds', value: '30' },
          { label: 'Every 60 seconds', value: '60' },
        ],
      },
      {
        name: 'notifyOnDown',
        type: 'boolean',
        label: 'Notify on server down',
        description: 'Send desktop notification when server is unreachable',
        value: CONFIG.notifyOnDown,
      },
      {
        name: 'notifyOnRecover',
        type: 'boolean',
        label: 'Notify on recovery',
        description: 'Send desktop notification when server recovers',
        value: CONFIG.notifyOnRecover,
      },
      {
        name: 'verboseLogging',
        type: 'boolean',
        label: 'Verbose logging',
        description: 'Log every ping result to console',
        value: CONFIG.verboseLogging,
      },
    ],
  };
}

function onSetOption(args: { name: string; value: unknown }): void {
  const { name, value } = args;

  if (name === 'pingIntervalSec') {
    const newInterval = parseInt(value as string) || 10;
    CONFIG.pingIntervalSec = newInterval;
    // Re-register cron with new interval
    cron.unregister('ping');
    const cronExpr = `*/${newInterval} * * * * *`;
    cron.register('ping', cronExpr);
    console.log(`[server-ping] Ping interval changed to ${newInterval}s`);
  } else if (name === 'notifyOnDown') {
    CONFIG.notifyOnDown = !!value;
  } else if (name === 'notifyOnRecover') {
    CONFIG.notifyOnRecover = !!value;
  } else if (name === 'verboseLogging') {
    CONFIG.verboseLogging = !!value;
  }

  // Persist updated config
  store.set('config', CONFIG);
  publishState();
  console.log(`[server-ping] Option '${name}' set to ${value}`);
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function onSessionStart(args: { sessionId: string }): void {
  const { sessionId } = args;
  ACTIVE_SESSIONS.push(sessionId);
  console.log(`[server-ping] Session started: ${sessionId} (active: ${ACTIVE_SESSIONS.length})`);
}

function onSessionEnd(args: { sessionId: string }): void {
  const { sessionId } = args;
  ACTIVE_SESSIONS = ACTIVE_SESSIONS.filter(s => s !== sessionId);
  console.log(`[server-ping] Session ended: ${sessionId} (active: ${ACTIVE_SESSIONS.length})`);
}

// ---------------------------------------------------------------------------
// Cron handler — the main ping logic
// ---------------------------------------------------------------------------

function onCronTrigger(scheduleId: string): void {
  if (scheduleId !== 'ping') return;
  doPing();
}

function doPing(): void {
  PING_COUNT++;
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  try {
    const response = net.fetch(CONFIG.serverUrl, { method: 'GET', timeout: 10 });

    const latencyMs = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 400;

    if (!success) {
      FAIL_COUNT++;
      CONSECUTIVE_FAILS++;
    } else {
      // Check if recovering from downtime
      if (WAS_DOWN && CONFIG.notifyOnRecover) {
        sendNotification(
          'Server Recovered',
          `${CONFIG.serverUrl} is back online (was down for ${CONSECUTIVE_FAILS} checks)`
        );
      }
      CONSECUTIVE_FAILS = 0;
      WAS_DOWN = false;
    }

    if (CONFIG.verboseLogging) {
      console.log(`[server-ping] #${PING_COUNT} ${response.status} ${latencyMs}ms`);
    }

    // Log to DB
    db.exec(
      'INSERT INTO ping_log (timestamp, url, status, latency_ms, success, error) VALUES (?, ?, ?, ?, ?, ?)',
      [timestamp, CONFIG.serverUrl, response.status, latencyMs, success ? 1 : 0, null]
    );
  } catch (e) {
    const latencyMs = Date.now() - startTime;
    FAIL_COUNT++;
    CONSECUTIVE_FAILS++;

    console.error(`[server-ping] #${PING_COUNT} FAILED: ${e}`);

    // Log failure to DB
    db.exec(
      'INSERT INTO ping_log (timestamp, url, status, latency_ms, success, error) VALUES (?, ?, ?, ?, ?, ?)',
      [timestamp, CONFIG.serverUrl, 0, latencyMs, 0, String(e)]
    );

    // Notify on first failure
    if (CONSECUTIVE_FAILS === 1 && CONFIG.notifyOnDown) {
      WAS_DOWN = true;
      sendNotification('Server Down', `${CONFIG.serverUrl} is unreachable: ${e}`);
    }
  }

  // Sync state to globalThis for bundled tools
  _syncState();

  // Persist counters periodically (every 10 pings)
  if (PING_COUNT % 10 === 0) {
    store.set('counters', { pingCount: PING_COUNT, failCount: FAIL_COUNT });
  }

  // Publish state to frontend
  publishState();

  // Append to data log file (last 100 entries summary)
  appendDataLog(timestamp);
}

// ---------------------------------------------------------------------------
// State publishing (real-time frontend updates)
// ---------------------------------------------------------------------------

function publishState(): void {
  const uptimePct =
    PING_COUNT > 0 ? Math.round(((PING_COUNT - FAIL_COUNT) / PING_COUNT) * 10000) / 100 : 100;

  // Get latest latency from DB
  const latest = db.get(
    'SELECT latency_ms, status, success FROM ping_log ORDER BY id DESC LIMIT 1',
    []
  ) as { latency_ms: number; status: number; success: number } | null;

  state.setPartial({
    status: CONSECUTIVE_FAILS > 0 ? 'down' : 'healthy',
    pingCount: PING_COUNT,
    failCount: FAIL_COUNT,
    consecutiveFails: CONSECUTIVE_FAILS,
    uptimePercent: uptimePct,
    lastLatencyMs: latest ? latest.latency_ms : null,
    lastStatus: latest ? latest.status : null,
    serverUrl: CONFIG.serverUrl,
    activeSessions: ACTIVE_SESSIONS.length,
    platform: platform.os(),
  });
}

// Expose functions to globalThis for bundled tool modules
_g.doPing = doPing;
_g.publishState = publishState;

// ---------------------------------------------------------------------------
// Data file logging
// ---------------------------------------------------------------------------

function appendDataLog(timestamp: string): void {
  const recent = db.all(
    'SELECT timestamp, status, latency_ms, success, error FROM ping_log ORDER BY id DESC LIMIT 20',
    []
  ) as {
    timestamp: string;
    status: number;
    latency_ms: number;
    success: number;
    error: string | null;
  }[];

  const lines = ['# Ping Log (last 20 entries)', `# Generated: ${timestamp}`, ''];
  for (const r of recent) {
    const statusStr = r.success ? `OK ${r.status}` : 'FAIL';
    lines.push(
      `${r.timestamp} | ${statusStr} | ${r.latency_ms}ms${r.error ? ` | ${r.error}` : ''}`
    );
  }
  data.write('ping-log.txt', lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function sendNotification(title: string, body: string): void {
  const currentOs = platform.os();
  if (currentOs === 'android' || currentOs === 'ios') {
    console.log(`[server-ping] Notification (mobile, skipped): ${title} — ${body}`);
    return;
  }
  try {
    platform.notify(title, body);
  } catch (e) {
    console.warn(`[server-ping] Notification failed: ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Tools (callable by AI and other skills)
// ---------------------------------------------------------------------------

// Runtime lifecycle hooks (called by V8 host, not within this module)
void init;
void start;
void stop;
void onCronTrigger;
void onSetupStart;
void onSetupSubmit;
void onSetupCancel;
void onListOptions;
void onSetOption;
void onSessionStart;
void onSessionEnd;

const tools = [
  getPingStatsTool,
  getPingHistoryTool,
  pingNowTool,
  listPeerSkillsTool,
  updateServerUrlTool,
  readConfigTool,
];

const skill: Skill = {
  info: {
    id: 'server-ping',
    name: 'Server Ping',
    runtime: 'v8',
    entry: 'index.js',
    version: '2.0.0',
    description:
      'Monitors server health with configurable ping intervals. Demos setup flow, DB, state, data, cron, net, platform, skills interop, options, and tools.',
    auto_start: false,
    setup: { required: true, label: 'Configure Server Ping' },
  },
  tools,
  init,
  start,
  stop,
  onCronTrigger,
  onSetupStart,
  onSetupSubmit,
  onSetupCancel,
  onListOptions,
  onSetOption,
  onSessionStart,
  onSessionEnd,
};

export default skill;

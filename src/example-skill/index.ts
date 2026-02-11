/**
 * example-skill — Kitchen-sink skill demonstrating every bridge API,
 * lifecycle hook, setup wizard, options system, and tool pattern.
 *
 * Use this as a reference when building your own skill.
 */
// ─── State & Types ───────────────────────────────────────────────────
import './skill-state';
import type { ExampleSkillState } from './skill-state';
import { DEFAULT_CONFIG, type ExampleConfig } from './types';

function getState(): ExampleSkillState {
  return (globalThis as any).getSkillState();
}

// ─── Tools ───────────────────────────────────────────────────────────
// Tools are exposed to the AI and other skills.
// Each tool.execute() must return a JSON string.
// NOTE: Tools are defined inline to avoid cross-module bundling issues.

const tools = [
  // get-status — returns current skill status, config summary, and error count
  {
    name: 'get-status',
    description: 'Get current skill status including configuration summary and error count.',
    input_schema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'string',
          enum: ['true', 'false'],
          description: 'Include full config in response (default: false)',
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const s = getState();
      const verbose = args.verbose === 'true';

      const result: Record<string, unknown> = {
        status: s.isRunning ? 'running' : 'stopped',
        fetchCount: s.fetchCount,
        errorCount: s.errorCount,
        lastFetchTime: s.lastFetchTime,
        refreshInterval: s.config.refreshInterval,
        platform: platform.os(),
      };

      if (verbose)
        result.config = {
          serverUrl: s.config.serverUrl,
          refreshInterval: s.config.refreshInterval,
          notifyOnError: s.config.notifyOnError,
          verbose: s.config.verbose,
        };

      return JSON.stringify(result);
    },
  },

  // fetch-data — makes an HTTP request to the configured server URL
  {
    name: 'fetch-data',
    description: 'Fetch data from the configured server URL. Returns the response status and body.',
    input_schema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Optional path to append to the server URL (e.g., "/health")',
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const s = getState();
      const endpoint = (args.endpoint as string) || '';
      const url = s.config.serverUrl + endpoint;

      if (!s.config.serverUrl) return JSON.stringify({ error: 'Server URL not configured' });

      try {
        const response = await net.fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${s.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        s.fetchCount++;
        s.lastFetchTime = new Date().toISOString();

        return JSON.stringify({ status: response.status, body: response.body });
      } catch (e) {
        s.errorCount++;
        return JSON.stringify({ error: String(e) });
      }
    },
  },

  // query-logs — query the SQLite logs table with limit
  {
    name: 'query-logs',
    description: 'Query recent log entries from the skill database.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return (default: 10)',
          minimum: 1,
          maximum: 100,
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const limit = typeof args.limit === 'number' ? args.limit : 10;
      const rows = db.all(`SELECT * FROM logs ORDER BY id DESC LIMIT ${limit}`, []);
      return JSON.stringify({ count: rows.length, rows });
    },
  },

  // list-peers — discover other skills via skills.list()
  {
    name: 'list-peers',
    description: 'List all registered skills in the runtime.',
    input_schema: { type: 'object', properties: {} },
    async execute(_args: Record<string, unknown>): Promise<string> {
      const peers = skills.list();
      return JSON.stringify({ count: peers.length, skills: peers });
    },
  },
];

// ─── Lifecycle: init() ──────────────────────────────────────────────
// Called once when the skill is first loaded.
// Use this to create database tables and load persisted config.
async function init(): Promise<void> {
  const s = getState();

  // Create database table for logs
  db.exec(
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    []
  );

  // Load persisted configuration from store
  const saved = state.get('config') as Partial<ExampleConfig> | null;
  if (saved) {
    s.config = { ...DEFAULT_CONFIG, ...saved };
  }

  // Log initialization
  if (s.config.verbose)
    console.log('[example-skill] Initialized with config:', JSON.stringify(s.config));
}

// ─── Lifecycle: start() ─────────────────────────────────────────────
// Called when the skill should begin active work.
// Register cron schedules, hooks, and publish initial state.
async function start(): Promise<void> {
  const s = getState();
  s.isRunning = true;

  // Register a cron schedule for periodic data fetching
  // 6-field syntax: seconds minutes hours day month dow
  cron.register('refresh', `*/${s.config.refreshInterval} * * * * *`);

  // ─── Hook Registration Example ─────────────────────────────────────
  // Register a hook to react to Telegram messages in monitored chats.
  // The hook uses declarative filters evaluated by the Rust runtime —
  // no JS callback per event, so it's efficient at scale.
  //
  // hooks.register({
  //   id: 'watch-messages',
  //   description: 'Watch for message bursts in monitored chats',
  //   filter: {
  //     event_types: ['telegram.message.received'],
  //     entities: {
  //       chat: { ids: ['12345', '67890'] },        // user-configured chat IDs
  //     },
  //     data_match: [
  //       { path: 'is_outgoing', op: 'eq', value: false },  // only incoming
  //     ],
  //   },
  //   accumulate: {
  //     count: 5,              // fire after 5 messages
  //     window_ms: 30000,      // within a 30-second window
  //     group_by: 'entities.chat.id',  // per-chat batching
  //     reset_on_fire: true,
  //   },
  // });
  // ───────────────────────────────────────────────────────────────────

  // Publish initial state to the frontend
  publishState();

  if (s.config.verbose)
    console.log('[example-skill] Started with interval:', s.config.refreshInterval);
}

// ─── Lifecycle: stop() ──────────────────────────────────────────────
// Called on shutdown. Unregister cron schedules and persist state.
async function stop(): Promise<void> {
  const s = getState();
  s.isRunning = false;

  // Unregister all cron schedules
  cron.unregister('refresh');

  // Persist configuration
  state.set('config', s.config);

  // Persist a data file with last-known state
  data.write(
    'last-state.json',
    JSON.stringify({
      fetchCount: s.fetchCount,
      errorCount: s.errorCount,
      lastFetchTime: s.lastFetchTime,
      stoppedAt: new Date().toISOString(),
    })
  );

  if (s.config.verbose) console.log('[example-skill] Stopped');
}

// ─── Lifecycle: onCronTrigger ───────────────────────────────────────
// Called when a registered cron schedule fires.
async function onCronTrigger(scheduleId: string): Promise<void> {
  if (scheduleId !== 'refresh') return;

  const s = getState();
  if (!s.config.serverUrl) return;

  try {
    const response = await net.fetch(s.config.serverUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${s.config.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    s.fetchCount++;
    s.lastFetchTime = new Date().toISOString();

    // Log to database
    db.exec('INSERT INTO logs (level, message, created_at) VALUES (?, ?, ?)', [
      'info',
      `Fetch OK: status=${response.status}`,
      s.lastFetchTime,
    ]);

    // Reset error count on success
    s.errorCount = 0;
  } catch (e) {
    s.errorCount++;

    db.exec('INSERT INTO logs (level, message, created_at) VALUES (?, ?, ?)', [
      'error',
      `Fetch failed: ${String(e)}`,
      new Date().toISOString(),
    ]);

    // Send notification if configured
    if (s.config.notifyOnError)
      platform.notify('Example Skill Error', `Fetch failed: ${String(e)}`);
  }

  // Always publish updated state
  publishState();
}

// ─── Lifecycle: onSessionStart / onSessionEnd ───────────────────────
// Called when the user starts or ends an AI conversation.
async function onSessionStart(_args: { sessionId: string }): Promise<void> {
  const s = getState();
  if (s.config.verbose) console.log('[example-skill] Session started');
}

async function onSessionEnd(_args: { sessionId: string }): Promise<void> {
  const s = getState();
  if (s.config.verbose) console.log('[example-skill] Session ended');
}

// ─── Setup Flow (3-step wizard) ─────────────────────────────────────
// Multi-step configuration wizard presented to the user on first run.

async function onSetupStart(): Promise<SetupStartResult> {
  return {
    step: {
      id: 'credentials',
      title: 'API Credentials',
      description: 'Enter the server URL and API key.',
      fields: [
        {
          name: 'serverUrl',
          type: 'text',
          label: 'Server URL',
          description: 'Full URL (e.g., https://api.example.com)',
          required: true,
          placeholder: 'https://api.example.com',
        },
        {
          name: 'apiKey',
          type: 'password',
          label: 'API Key',
          description: 'Your API key for authentication',
          required: true,
        },
      ],
    },
  };
}

async function onSetupSubmit(args: {
  stepId: string;
  values: Record<string, unknown>;
}): Promise<SetupSubmitResult> {
  const s = getState();

  // Step 1: Credentials
  if (args.stepId === 'credentials') {
    const serverUrl = args.values.serverUrl as string;
    const apiKey = args.values.apiKey as string;

    if (!serverUrl)
      return {
        status: 'error',
        errors: [{ field: 'serverUrl', message: 'Server URL is required' }],
      };
    if (!apiKey)
      return { status: 'error', errors: [{ field: 'apiKey', message: 'API key is required' }] };

    s.config.serverUrl = serverUrl;
    s.config.apiKey = apiKey;

    // Advance to step 2
    return {
      status: 'next',
      nextStep: {
        id: 'webhook',
        title: 'Webhook Configuration',
        description: 'Optionally configure a webhook for external notifications.',
        fields: [
          {
            name: 'webhookUrl',
            type: 'text',
            label: 'Webhook URL',
            description: 'POST notifications to this URL (leave empty to skip)',
          },
        ],
      },
    };
  }

  // Step 2: Webhook
  if (args.stepId === 'webhook') {
    s.config.webhookUrl = (args.values.webhookUrl as string) || '';

    // Advance to step 3
    return {
      status: 'next',
      nextStep: {
        id: 'preferences',
        title: 'Notification Preferences',
        description: 'Choose your notification settings.',
        fields: [
          {
            name: 'notifyOnError',
            type: 'boolean',
            label: 'Notify on error',
            description: 'Send a desktop notification when a fetch fails',
            default: true,
          },
          {
            name: 'refreshInterval',
            type: 'select',
            label: 'Refresh Interval',
            options: [
              { label: 'Every 10 seconds', value: '10' },
              { label: 'Every 30 seconds', value: '30' },
              { label: 'Every 60 seconds', value: '60' },
              { label: 'Every 5 minutes', value: '300' },
            ],
            default: '30',
          },
        ],
      },
    };
  }

  // Step 3: Preferences (final)
  if (args.stepId === 'preferences') {
    s.config.notifyOnError = args.values.notifyOnError !== false;
    s.config.refreshInterval = parseInt(String(args.values.refreshInterval || '30'), 10);

    // Persist the complete configuration
    state.set('config', s.config);

    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: 'Unknown step' }] };
}

async function onSetupCancel(): Promise<void> {
  // Reset config to defaults if setup is cancelled
  const s = getState();
  s.config = { ...DEFAULT_CONFIG };
}

// ─── Lifecycle: onHookTriggered ──────────────────────────────────────
// Called when a registered hook's filter matches and accumulation
// conditions are met. Return actions for the runtime/frontend.
//
// function onHookTriggered(args: HookTriggeredArgs): HookActionResult {
//   const messages = args.events
//     .map(e => e.data.text as string)
//     .filter(Boolean);
//
//   console.log(
//     `[example-skill] Hook "${args.hookId}" fired with ${args.eventCount} events`
//   );
//
//   return {
//     actions: [{
//       type: 'notify',
//       payload: {
//         title: 'Message Burst Detected',
//         body: `${args.eventCount} messages in chat ${args.groupKey}`,
//       },
//     }],
//   };
// }

// ─── Disconnect ─────────────────────────────────────────────────────
async function onDisconnect(): Promise<void> {
  // Clean up credentials when user disconnects the skill
  state.delete('config');
  const s = getState();
  s.config = { ...DEFAULT_CONFIG };
}

// ─── Options System ─────────────────────────────────────────────────
// Runtime-configurable settings the user can change without re-running setup.

async function onListOptions(): Promise<{ options: SkillOption[] }> {
  const s = getState();
  return {
    options: [
      {
        name: 'refreshInterval',
        type: 'select',
        label: 'Refresh Interval',
        description: 'How often to fetch data',
        value: String(s.config.refreshInterval),
        options: [
          { label: 'Every 10 seconds', value: '10' },
          { label: 'Every 30 seconds', value: '30' },
          { label: 'Every 60 seconds', value: '60' },
          { label: 'Every 5 minutes', value: '300' },
        ],
      },
      {
        name: 'notifyOnError',
        type: 'boolean',
        label: 'Notify on Error',
        description: 'Send desktop notification on fetch failure',
        value: s.config.notifyOnError,
      },
      {
        name: 'verbose',
        type: 'boolean',
        label: 'Verbose Logging',
        description: 'Log extra debug information to the console',
        value: s.config.verbose,
      },
    ],
  };
}

async function onSetOption(args: { name: string; value: unknown }): Promise<void> {
  const s = getState();

  if (args.name === 'refreshInterval') {
    s.config.refreshInterval = parseInt(String(args.value), 10);
    // Re-register cron with new interval
    cron.unregister('refresh');
    cron.register('refresh', `*/${s.config.refreshInterval} * * * * *`);
  } else if (args.name === 'notifyOnError') {
    s.config.notifyOnError = args.value === true || args.value === 'true';
  } else if (args.name === 'verbose') {
    s.config.verbose = args.value === true || args.value === 'true';
  }

  state.set('config', s.config);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Publish current state to the frontend for real-time display */
async function publishState(): Promise<void> {
  const s = getState();
  state.setPartial({
    status: s.isRunning ? 'running' : 'stopped',
    fetchCount: s.fetchCount,
    errorCount: s.errorCount,
    lastFetchTime: s.lastFetchTime,
    refreshInterval: s.config.refreshInterval,
    platform: platform.os(),
  });
}

// Expose helpers on globalThis so tools and tests can call them
const _g = globalThis as Record<string, unknown>;
_g.publishState = publishState;

const skill: Skill = {
  info: {
    id: 'example-skill',
    name: 'Example Skill',
    version: '1.0.0',
    description: 'A skill for testing the skill host',
    auto_start: false,
    setup: { required: true, label: 'Example Skill' },
  },
  tools: tools as ToolDefinition[],
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

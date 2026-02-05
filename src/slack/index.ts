// slack/index.ts
// Full-fledged Slack bot skill: read/send messages, receive real-time events, store messages in DB.

import { listChannelsTool } from './tools/list-channels';
import { getMessagesTool } from './tools/get-messages';
import { sendMessageTool } from './tools/send-message';
import { getStoredMessagesTool } from './tools/get-stored-messages';
import { getChannelTool } from './tools/get-channel';
import { openDmTool } from './tools/open-dm';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface SlackConfig {
  botToken: string;
  workspaceName: string;
}

const CONFIG: SlackConfig = { botToken: '', workspaceName: '' };

const SLACK_BASE_URL = 'https://slack.com/api';
const SLACK_REQUEST_TIMEOUT = 15000;

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log('[slack] Initializing');

  // Create table for messages received via events
  db.exec(
    `CREATE TABLE IF NOT EXISTS slack_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      user_id TEXT,
      ts TEXT NOT NULL,
      text TEXT,
      type TEXT,
      subtype TEXT,
      event_type TEXT,
      thread_ts TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(channel_id, ts)
    )`,
    []
  );

  // Load persisted config from store
  const saved = store.get('config') as Partial<SlackConfig> | null;
  if (saved) {
    CONFIG.botToken = (saved.botToken as string) ?? '';
    CONFIG.workspaceName = (saved.workspaceName as string) ?? '';
  }

  if (CONFIG.botToken) {
    console.log(`[slack] Connected to workspace: ${CONFIG.workspaceName || '(unnamed)'}`);
  } else {
    console.log('[slack] No bot token configured — waiting for setup');
  }

  publishState();
}

function start(): void {
  if (!CONFIG.botToken) {
    console.log('[slack] No bot token — skill inactive until setup completes');
    return;
  }
  console.log('[slack] Started');
  publishState();
}

function stop(): void {
  console.log('[slack] Stopped');
  state.set('status', 'stopped');
}

// ---------------------------------------------------------------------------
// Setup flow (single step: bot token)
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  return {
    step: {
      id: 'bot_token',
      title: 'Connect Slack',
      description:
        'Enter your Slack Bot User OAuth Token (xoxb-...). ' +
        'Create an app at https://api.slack.com/apps and install it to your workspace. ' +
        'Find the token under OAuth & Permissions > Bot User OAuth Token.',
      fields: [
        {
          name: 'bot_token',
          type: 'password',
          label: 'Bot Token',
          description: 'Your Slack bot token (starts with xoxb-)',
          required: true,
          placeholder: 'xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
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

  if (stepId !== 'bot_token') {
    return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
  }

  const rawToken = ((values.bot_token as string) ?? '').trim();

  if (!rawToken) {
    return {
      status: 'error',
      errors: [{ field: 'bot_token', message: 'Bot token is required' }],
    };
  }

  if (!rawToken.startsWith('xoxb-')) {
    return {
      status: 'error',
      errors: [
        {
          field: 'bot_token',
          message: "Bot token should start with 'xoxb-'. Check your Slack app settings.",
        },
      ],
    };
  }

  // Validate token by calling auth.test
  try {
    const response = net.fetch(`${SLACK_BASE_URL}/auth.test`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15,
    });

    if (response.status !== 200) {
      return {
        status: 'error',
        errors: [{ field: 'bot_token', message: `Slack API error: ${response.status}` }],
      };
    }

    const auth = JSON.parse(response.body) as { ok?: boolean; team?: string; url?: string; error?: string };
    if (!auth.ok) {
      const err = auth.error || 'invalid_auth';
      return {
        status: 'error',
        errors: [
          {
            field: 'bot_token',
            message: err === 'invalid_auth' ? 'Invalid bot token. Please check your token.' : `Slack error: ${err}`,
          },
        ],
      };
    }

    const workspaceName = (auth.team as string) || (auth.url as string) || '';
    CONFIG.botToken = rawToken;
    CONFIG.workspaceName = workspaceName;
    store.set('config', CONFIG);
    data.write('config.json', JSON.stringify({ workspaceName }, null, 2));

    console.log(`[slack] Setup complete — connected to ${workspaceName || 'workspace'}`);
    publishState();
    return { status: 'complete' };
  } catch (e) {
    return {
      status: 'error',
      errors: [{ field: 'bot_token', message: `Failed to connect: ${formatApiError(e)}` }],
    };
  }
}

function onSetupCancel(): void {
  console.log('[slack] Setup cancelled');
}

// ---------------------------------------------------------------------------
// Event-driven ingestion: onServerEvent
// ---------------------------------------------------------------------------

function onServerEvent(event: string, data: unknown): void {
  if (event !== 'slack') {
    return;
  }

  const envelope = data as Record<string, unknown> | null;
  if (!envelope || typeof envelope !== 'object') {
    return;
  }

  // Events API: { type: 'event_callback', event: { type: 'message', channel, user, ts, text, ... } }
  // Socket Mode: similar envelope
  const eventPayload = envelope.event as Record<string, unknown> | undefined;
  if (!eventPayload || typeof eventPayload !== 'object') {
    return;
  }

  const eventType = eventPayload.type as string | undefined;
  if (eventType !== 'message' && eventType !== 'app_mention') {
    return;
  }

  // Skip bot messages to avoid storing our own messages
  if (eventPayload.bot_id != null) {
    return;
  }

  const channelId = eventPayload.channel as string | undefined;
  const ts = eventPayload.ts as string | undefined;
  if (!channelId || !ts) {
    return;
  }

  const userId = eventPayload.user as string | undefined;
  const text = (eventPayload.text as string) ?? '';
  const type = (eventPayload.type as string) ?? 'message';
  const subtype = eventPayload.subtype as string | undefined;
  const threadTs = eventPayload.thread_ts as string | undefined;
  const createdAt = new Date().toISOString();

  try {
    db.exec(
      `INSERT OR IGNORE INTO slack_messages (channel_id, user_id, ts, text, type, subtype, event_type, thread_ts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [channelId, userId ?? null, ts, text, type, subtype ?? null, eventType, threadTs ?? null, createdAt]
    );
    state.setPartial({ last_event_at: createdAt });
  } catch (e) {
    console.error('[slack] Failed to store event:', e);
  }
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishState(): void {
  state.setPartial({
    connected: !!CONFIG.botToken,
    workspaceName: CONFIG.workspaceName || null,
  });
}

// ---------------------------------------------------------------------------
// Slack API helper (exposed on globalThis for tools)
// ---------------------------------------------------------------------------

function slackApiFetch(
  method: string,
  endpoint: string,
  params?: Record<string, unknown>
): Record<string, unknown> {
  const token = CONFIG.botToken;
  if (!token) {
    throw new Error('Slack not connected. Please complete setup first.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SLACK_BASE_URL}${endpoint}`;
  const isGet = method.toUpperCase() === 'GET';

  let fullUrl = url;
  let body: string | undefined;

  if (isGet && params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        search.set(k, String(v));
      }
    }
    fullUrl = `${url}?${search.toString()}`;
  } else if (!isGet && params) {
    body = JSON.stringify(params);
  }

  const response = net.fetch(fullUrl, {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
    timeout: SLACK_REQUEST_TIMEOUT,
  });

  if (response.status === 429) {
    throw new Error('Slack rate limited. Please try again in a moment.');
  }

  const parsed = JSON.parse(response.body) as Record<string, unknown>;
  if (!parsed.ok && response.status >= 400) {
    const err = parsed.error as string | undefined;
    throw new Error(err || `Slack API error: ${response.status}`);
  }

  return parsed;
}

function formatApiError(error: unknown): string {
  const message = String(error);
  if (message.includes('401') || message.includes('invalid_auth')) {
    return 'Invalid or expired token. Check your Slack app settings.';
  }
  if (message.includes('429')) {
    return 'Rate limited. Please try again in a moment.';
  }
  if (message.includes('channel_not_found') || message.includes('not_in_channel')) {
    return 'Channel not found or bot is not in the channel.';
  }
  return message;
}

// Expose for tools (bundled code calls this via globalThis)
(globalThis as Record<string, unknown>).slackApiFetch = slackApiFetch;

// ---------------------------------------------------------------------------
// Tool registration and skill export
// ---------------------------------------------------------------------------

const tools = [
  listChannelsTool,
  getMessagesTool,
  sendMessageTool,
  getStoredMessagesTool,
  getChannelTool,
  openDmTool,
];

const skill: Skill = {
  info: {
    id: 'slack',
    name: 'Slack',
    runtime: 'v8',
    entry: 'index.js',
    version: '1.0.0',
    description:
      'Full-fledged Slack bot: read and send messages, receive real-time events, and store all received messages in the skill DB.',
    auto_start: false,
    setup: { required: true, label: 'Connect Slack' },
  },
  tools,
  init,
  start,
  stop,
  onSetupStart,
  onSetupSubmit,
  onSetupCancel,
  onServerEvent,
};

export default skill;

// slack/index.ts — Orchestrator
// Import order matters: state first, then schema, helpers, API, setup, sync, handlers.
import './api/slack';
import './db/helpers';
import './db/schema';
import './setup';
import './state';
import './sync';
import {
  getChannelTool,
  getMessagesTool,
  listChannelsTool,
  openDmTool,
  sendMessageTool,
  syncNowTool,
} from './tools';
import type { SlackConfig } from './types';
import './update-handlers';

// ---------------------------------------------------------------------------
// Inline display-text helper (also exposed on globalThis for bundled tools).
// Avoids bundle import issues — tools and sync access this via globalThis.
// ---------------------------------------------------------------------------

function getMessageDisplayText(msg: Record<string, unknown>): string {
  const text = (msg.text as string) ?? '';
  if (text.trim()) return text;
  if (Array.isArray(msg.blocks)) {
    const parts: string[] = [];
    for (const block of msg.blocks) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.text && typeof b.text === 'object' && b.text !== null && 'text' in (b.text as object)) {
        const t = (b.text as { text?: string }).text;
        if (typeof t === 'string' && t.trim()) parts.push(t.trim());
      }
      if (b.elements && Array.isArray(b.elements)) {
        for (const el of b.elements) {
          if (el && typeof el === 'object' && 'text' in (el as object)) {
            const t = (el as { text?: string }).text;
            if (typeof t === 'string' && t.trim()) parts.push(t.trim());
          }
        }
      }
    }
    if (parts.length > 0) return parts.join(' ');
  }
  if (Array.isArray(msg.attachments)) {
    const parts: string[] = [];
    for (const a of msg.attachments) {
      if (!a || typeof a !== 'object') continue;
      const at = a as Record<string, unknown>;
      for (const key of ['fallback', 'pretext', 'title', 'text']) {
        const v = at[key];
        if (typeof v === 'string' && v.trim()) parts.push(v.trim());
      }
    }
    if (parts.length > 0) return parts.join(' ');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  console.log('[slack] Initializing');
  globalThis.initializeSlackSchema();

  const s = globalThis.getSlackSkillState();
  const saved = state.get('config') as Partial<SlackConfig> | null;
  if (saved) {
    s.config.botToken = (saved.botToken as string) ?? '';
    s.config.workspaceName = (saved.workspaceName as string) ?? '';
    s.config.syncIntervalMinutes =
      typeof (saved.syncIntervalMinutes as number) === 'number'
        ? (saved.syncIntervalMinutes as number)
        : 20;
  }

  const savedLastSync = state.get('lastSyncTime') as number | null;
  if (savedLastSync && typeof savedLastSync === 'number') {
    s.lastSyncTime = savedLastSync;
  }

  const savedPerChannel = state.get('lastSyncedLatestPerChannel') as Record<string, string> | null;
  if (savedPerChannel && typeof savedPerChannel === 'object') {
    s.lastSyncedLatestPerChannel = { ...savedPerChannel };
  }

  if (s.config.botToken) {
    console.log(`[slack] Connected to workspace: ${s.config.workspaceName || '(unnamed)'}`);
  } else {
    console.log('[slack] No bot token configured — waiting for setup');
  }

  publishState();
}

async function start(): Promise<void> {
  const s = globalThis.getSlackSkillState();
  if (!s.config.botToken) {
    console.log('[slack] No bot token — skill inactive until setup completes');
    return;
  }
  const mins = s.config.syncIntervalMinutes;
  const cronExpr = `0 */${mins} * * * *`;
  cron.register('slack-sync', cronExpr);
  console.log(`[slack] Started — sync every ${mins} minutes`);

  const tenMinsMs = 10 * 60 * 1000;
  if (s.lastSyncTime === 0 || Date.now() - s.lastSyncTime > tenMinsMs) {
    globalThis.slackSync.performSync();
  } else {
    console.log('[slack] Skipping initial sync (last sync was within 10 minutes)');
  }
  publishState();
}

async function stop(): Promise<void> {
  const s = globalThis.getSlackSkillState();
  cron.unregister('slack-sync');
  state.set('config', s.config);
  state.set('lastSyncTime', s.lastSyncTime);
  state.set('lastSyncedLatestPerChannel', s.lastSyncedLatestPerChannel);
  console.log('[slack] Stopped');
  state.set('status', 'stopped');
  publishState();
}

async function onCronTrigger(scheduleId: string): Promise<void> {
  if (scheduleId === 'slack-sync') {
    globalThis.slackSync.performSync();
  }
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

async function publishState(): Promise<void> {
  const s = globalThis.getSlackSkillState();
  state.setPartial({
    connected: !!s.config.botToken,
    workspaceName: s.config.workspaceName || null,
    lastSyncTime: s.lastSyncTime > 0 ? s.lastSyncTime : null,
    syncInProgress: s.syncInProgress,
  });
}

// ---------------------------------------------------------------------------
// Expose on globalThis
// ---------------------------------------------------------------------------

const _g = globalThis as Record<string, unknown>;
_g.getMessageDisplayText = getMessageDisplayText;
_g.slackApiFetch = globalThis.slackApi.slackApiFetch;
_g.performSlackSync = globalThis.slackSync.performSync;
_g.slackPublishState = publishState;
_g.getSlackSyncStatus = function (): {
  lastSyncTime: number;
  syncInProgress: boolean;
  lastSyncChannels: number;
  lastSyncMessages: number;
} {
  const s = globalThis.getSlackSkillState();
  return {
    lastSyncTime: s.lastSyncTime,
    syncInProgress: s.syncInProgress,
    lastSyncChannels: s.lastSyncChannels,
    lastSyncMessages: s.lastSyncMessages,
  };
};

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const tools = [
  listChannelsTool,
  getMessagesTool,
  sendMessageTool,
  getChannelTool,
  openDmTool,
  syncNowTool,
];

const skill: Skill = {
  info: {
    id: 'slack',
    name: 'Slack',
    version: '1.0.0',
    description:
      'Full-fledged Slack bot: read and send messages, receive real-time events, periodic sync to DB, and store all messages in the skill DB.',
    auto_start: false,
    setup: { required: true, label: 'Connect Slack' },
  },
  tools,
  init,
  start,
  stop,
  onCronTrigger,
  onSetupStart: globalThis.slackSetup.onSetupStart,
  onSetupSubmit: globalThis.slackSetup.onSetupSubmit,
  onSetupCancel: globalThis.slackSetup.onSetupCancel,
  onServerEvent: globalThis.slackUpdateHandlers.onServerEvent,
};

export default skill;

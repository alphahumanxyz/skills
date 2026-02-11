// google-calendar/index.ts — Orchestrator
import './api/calendar';
import './state';
import {
  createEventTool,
  deleteEventTool,
  getEventTool,
  listCalendarsTool,
  listEventsTool,
  updateEventTool,
} from './tools';
import type { SkillConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  console.log(`[google-calendar] Initializing on ${platform.os()}`);
  const s = globalThis.getGoogleCalendarSkillState();
  const saved = state.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    s.config.credentialId = saved.credentialId || s.config.credentialId;
    s.config.userEmail = saved.userEmail || s.config.userEmail;
  }
  const isConnected = !!oauth.getCredential();
  console.log(`[google-calendar] Initialized. Connected: ${isConnected}`);
}

async function start(): Promise<void> {
  console.log('[google-calendar] Starting skill...');
  publishSkillState();
}

async function stop(): Promise<void> {
  console.log('[google-calendar] Stopping skill...');
  const s = globalThis.getGoogleCalendarSkillState();
  state.set('config', s.config);
  console.log('[google-calendar] Skill stopped');
}

async function onSessionStart(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  s.activeSessions.push(args.sessionId);
}

async function onSessionEnd(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  const i = s.activeSessions.indexOf(args.sessionId);
  if (i > -1) s.activeSessions.splice(i, 1);
}

async function onOAuthComplete(args: OAuthCompleteArgs): Promise<void> {
  console.log(`[google-calendar] OAuth complete: ${args.provider}`);
  const s = globalThis.getGoogleCalendarSkillState();
  s.config.credentialId = args.credentialId;
  if (args.accountLabel) s.config.userEmail = args.accountLabel;
  state.set('config', s.config);
  publishSkillState();
}

async function onOAuthRevoked(_args: OAuthRevokedArgs): Promise<void> {
  const s = globalThis.getGoogleCalendarSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.set('config', s.config);
  publishSkillState();
}

async function onDisconnect(): Promise<void> {
  oauth.revoke();
  const s = globalThis.getGoogleCalendarSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.delete('config');
  publishSkillState();
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishSkillState(): void {
  const s = globalThis.getGoogleCalendarSkillState();
  const isConnected = !!oauth.getCredential();
  state.setPartial({
    connection_status: isConnected ? 'connected' : 'disconnected',
    auth_status: isConnected ? 'authenticated' : 'not_authenticated',
    connection_error: s.lastApiError || null,
    auth_error: null,
    is_initialized: isConnected,
    userEmail: s.config.userEmail,
    activeSessions: s.activeSessions.length,
    rateLimitRemaining: s.rateLimitRemaining,
    lastError: s.lastApiError,
  });
}

// ---------------------------------------------------------------------------
// Expose on globalThis for tools
// ---------------------------------------------------------------------------

const _g = globalThis as Record<string, unknown>;
_g.calendarFetch = globalThis.googleCalendarApi.calendarFetch;

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  listCalendarsTool,
  listEventsTool,
  getEventTool,
  createEventTool,
  updateEventTool,
  deleteEventTool,
];

const skill: Skill = {
  info: {
    id: 'google-calendar',
    name: 'Google Calendar',
    version: '1.0.0',
    description: 'Google Calendar integration',
    auto_start: false,
    setup: { required: true, label: 'Google Calendar' },
  },
  tools,
  init,
  start,
  stop,
  onSessionStart,
  onSessionEnd,
  onOAuthComplete,
  onOAuthRevoked,
  onDisconnect,
};

export default skill;

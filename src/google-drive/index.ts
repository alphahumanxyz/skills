// google-drive/index.ts — Orchestrator
import './api/drive';
import './state';
import {
  createDocumentTool,
  getDocumentTool,
  getFileTool,
  getSheetValuesTool,
  getSpreadsheetTool,
  listFilesTool,
  searchFilesTool,
  updateSheetValuesTool,
} from './tools';
import type { SkillConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  console.log(`[google-drive] Initializing on ${platform.os()}`);
  const s = globalThis.getGoogleDriveSkillState();
  const saved = state.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    s.config.credentialId = saved.credentialId || s.config.credentialId;
    s.config.userEmail = saved.userEmail || s.config.userEmail;
  }
  const isConnected = !!oauth.getCredential();
  console.log(`[google-drive] Initialized. Connected: ${isConnected}`);
}

async function start(): Promise<void> {
  console.log('[google-drive] Starting skill...');
  publishSkillState();
}

async function stop(): Promise<void> {
  console.log('[google-drive] Stopping skill...');
  const s = globalThis.getGoogleDriveSkillState();
  state.set('config', s.config);
  console.log('[google-drive] Skill stopped');
}

async function onSessionStart(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleDriveSkillState();
  s.activeSessions.push(args.sessionId);
}

async function onSessionEnd(args: { sessionId: string }): Promise<void> {
  const s = globalThis.getGoogleDriveSkillState();
  const i = s.activeSessions.indexOf(args.sessionId);
  if (i > -1) s.activeSessions.splice(i, 1);
}

async function onOAuthComplete(args: OAuthCompleteArgs): Promise<void> {
  console.log(`[google-drive] OAuth complete: ${args.provider}`);
  const s = globalThis.getGoogleDriveSkillState();
  s.config.credentialId = args.credentialId;
  if (args.accountLabel) s.config.userEmail = args.accountLabel;
  state.set('config', s.config);
  publishSkillState();
}

async function onOAuthRevoked(_args: OAuthRevokedArgs): Promise<void> {
  const s = globalThis.getGoogleDriveSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.set('config', s.config);
  publishSkillState();
}

async function onDisconnect(): Promise<void> {
  oauth.revoke();
  const s = globalThis.getGoogleDriveSkillState();
  s.config = { credentialId: '', userEmail: '' };
  state.delete('config');
  publishSkillState();
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishSkillState(): void {
  const s = globalThis.getGoogleDriveSkillState();
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
_g.driveFetch = globalThis.googleDriveApi.driveFetch;
_g.publishSkillState = publishSkillState;

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [
  listFilesTool,
  getFileTool,
  searchFilesTool,
  getSpreadsheetTool,
  getSheetValuesTool,
  updateSheetValuesTool,
  getDocumentTool,
  createDocumentTool,
];

const skill: Skill = {
  info: {
    id: 'google-drive',
    name: 'Google Drive',
    version: '1.0.0',
    description: 'Google Drive integration',
    auto_start: true,
    setup: { required: true, label: 'Google Drive' },
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

// notion/index.ts
// Notion integration skill exposing 22 tools for the Notion API.
// Supports pages, databases, blocks, users, and comments.
// Authentication is handled via the platform OAuth bridge.

// Import helpers
import {
  notionFetch,
  formatApiError,
  formatRichText,
  formatPageTitle,
  formatPageSummary,
  formatDatabaseSummary,
  formatBlockContent,
  formatBlockSummary,
  formatUserSummary,
  buildRichText,
  buildParagraphBlock,
} from './helpers';

// Import tools
import { searchTool } from './tools/search';
import { getPageTool } from './tools/get-page';
import { createPageTool } from './tools/create-page';
import { updatePageTool } from './tools/update-page';
import { deletePageTool } from './tools/delete-page';
import { getPageContentTool } from './tools/get-page-content';
import { listAllPagesTool } from './tools/list-all-pages';
import { appendTextTool } from './tools/append-text';
import { queryDatabaseTool } from './tools/query-database';
import { getDatabaseTool } from './tools/get-database';
import { createDatabaseTool } from './tools/create-database';
import { updateDatabaseTool } from './tools/update-database';
import { listAllDatabasesTool } from './tools/list-all-databases';
import { getBlockTool } from './tools/get-block';
import { getBlockChildrenTool } from './tools/get-block-children';
import { appendBlocksTool } from './tools/append-blocks';
import { updateBlockTool } from './tools/update-block';
import { deleteBlockTool } from './tools/delete-block';
import { listUsersTool } from './tools/list-users';
import { getUserTool } from './tools/get-user';
import { createCommentTool } from './tools/create-comment';
import { listCommentsTool } from './tools/list-comments';

// ---------------------------------------------------------------------------
// Expose helpers on globalThis for tools to access at runtime
// ---------------------------------------------------------------------------

const _g = globalThis as Record<string, unknown>;
_g.notionFetch = notionFetch;
_g.formatApiError = formatApiError;
_g.formatRichText = formatRichText;
_g.formatPageTitle = formatPageTitle;
_g.formatPageSummary = formatPageSummary;
_g.formatDatabaseSummary = formatDatabaseSummary;
_g.formatBlockContent = formatBlockContent;
_g.formatBlockSummary = formatBlockSummary;
_g.formatUserSummary = formatUserSummary;
_g.buildRichText = buildRichText;
_g.buildParagraphBlock = buildParagraphBlock;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let credentialId = '';
let workspaceName = '';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log('[notion] Initializing');

  const saved = store.get('config') as { credentialId?: string; workspaceName?: string } | null;
  if (saved) {
    credentialId = saved.credentialId ?? '';
    workspaceName = saved.workspaceName ?? '';
  }

  const cred = oauth.getCredential();
  if (cred) {
    credentialId = cred.credentialId;
    console.log(`[notion] Connected to workspace: ${workspaceName || '(unnamed)'}`);
  } else {
    console.log('[notion] No OAuth credential — waiting for setup');
  }

  publishState();
}

function start(): void {
  if (!oauth.getCredential()) {
    console.log('[notion] No credential — skill inactive until OAuth completes');
    return;
  }

  console.log('[notion] Started');
  publishState();
}

function stop(): void {
  console.log('[notion] Stopped');
  state.set('status', 'stopped');
}

// ---------------------------------------------------------------------------
// OAuth lifecycle
// ---------------------------------------------------------------------------

function onOAuthComplete(args: OAuthCompleteArgs): OAuthCompleteResult | void {
  credentialId = args.credentialId;
  console.log(`[notion] OAuth complete — credential: ${args.credentialId}, account: ${args.accountLabel || '(unknown)'}`);

  if (args.accountLabel) {
    workspaceName = args.accountLabel;
  }

  store.set('config', { credentialId, workspaceName });
  publishState();
}

function onOAuthRevoked(args: OAuthRevokedArgs): void {
  console.log(`[notion] OAuth revoked — reason: ${args.reason}`);
  credentialId = '';
  workspaceName = '';
  store.delete('config');
  publishState();
}

function onDisconnect(): void {
  console.log('[notion] Disconnecting');
  oauth.revoke();
  credentialId = '';
  workspaceName = '';
  store.delete('config');
  publishState();
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

function publishState(): void {
  state.setPartial({ connected: !!oauth.getCredential(), workspaceName: workspaceName || null });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

tools = [
  // Pages
  searchTool,
  getPageTool,
  createPageTool,
  updatePageTool,
  deletePageTool,
  getPageContentTool,
  listAllPagesTool,
  appendTextTool,
  // Databases
  queryDatabaseTool,
  getDatabaseTool,
  createDatabaseTool,
  updateDatabaseTool,
  listAllDatabasesTool,
  // Blocks
  getBlockTool,
  getBlockChildrenTool,
  appendBlocksTool,
  updateBlockTool,
  deleteBlockTool,
  // Users
  listUsersTool,
  getUserTool,
  // Comments
  createCommentTool,
  listCommentsTool,
];

// Suppress noUnusedLocals for runtime-called lifecycle functions
void init; void start; void stop; void onOAuthComplete; void onOAuthRevoked; void onDisconnect;
void credentialId;

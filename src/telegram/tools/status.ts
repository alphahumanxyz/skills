// Tool: telegram-status
// Get the current connection and authentication status.

declare const CONFIG: {
  apiId: number;
  apiHash: string;
  isAuthenticated: boolean;
  pendingCode: boolean;
  phoneNumber: string;
};
declare const CLIENT: unknown;
declare const CLIENT_CONNECTING: boolean;
declare const CLIENT_ERROR: string | null;
declare const CACHE: { me: unknown; dialogs: unknown[]; lastSync: number };

export const telegramStatusTool: ToolDefinition = {
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
};

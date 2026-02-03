// Tool: telegram-status
// Get the current connection and authentication status.

// Access skill state via globalThis (required for bundled code where variable names get mangled)
interface TelegramGlobalState {
  CONFIG: {
    apiId: number;
    apiHash: string;
    isAuthenticated: boolean;
    pendingCode: boolean;
    phoneNumber: string;
  };
  CLIENT: unknown;
  CLIENT_CONNECTING: boolean;
  CLIENT_ERROR: string | null;
  CACHE: { me: unknown; dialogs: unknown[]; lastSync: number };
}

export const telegramStatusTool: ToolDefinition = {
  name: 'telegram-status',
  description: 'Get the current connection and authentication status.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    const g = globalThis as unknown as TelegramGlobalState;
    const CONFIG = g.CONFIG;
    const CLIENT = g.CLIENT;
    const CLIENT_CONNECTING = g.CLIENT_CONNECTING;
    const CLIENT_ERROR = g.CLIENT_ERROR;
    const CACHE = g.CACHE;

    return JSON.stringify({
      connected: CLIENT !== null,
      connecting: CLIENT_CONNECTING,
      authenticated: CONFIG?.isAuthenticated ?? false,
      pendingCode: CONFIG?.pendingCode ?? false,
      hasCredentials: !!(CONFIG?.apiId && CONFIG?.apiHash),
      me: CACHE?.me ?? null,
      dialogCount: CACHE?.dialogs?.length ?? 0,
      lastSync: CACHE?.lastSync ?? 0,
      error: CLIENT_ERROR,
    });
  },
};

// Tool: telegram-connect
// Connect to Telegram servers. This is an async operation - returns a request ID.

// Access skill state via globalThis (required for bundled code where variable names get mangled)
interface TelegramGlobalState {
  CONFIG: { apiId: number; apiHash: string };
  enqueueRequest: (type: string, args: Record<string, unknown>) => string;
}

export const telegramConnectTool: ToolDefinition = {
  name: 'telegram-connect',
  description:
    'Connect to Telegram servers. This is an async operation - returns a request ID. ' +
    'Use telegram-get-result to check the status.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    const g = globalThis as unknown as TelegramGlobalState;
    const CONFIG = g.CONFIG;
    const enqueueRequest = g.enqueueRequest;

    if (!CONFIG?.apiId || !CONFIG?.apiHash) {
      return JSON.stringify({ error: 'API credentials not configured. Complete setup first.' });
    }
    if (!enqueueRequest) {
      return JSON.stringify({ error: 'enqueueRequest not available' });
    }
    const requestId = enqueueRequest('connect', {});
    return JSON.stringify({ status: 'pending', requestId });
  },
};

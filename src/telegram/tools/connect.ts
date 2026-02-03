// Tool: telegram-connect
// Connect to Telegram servers. This is an async operation - returns a request ID.

declare const CONFIG: { apiId: number; apiHash: string };
declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramConnectTool: ToolDefinition = {
  name: 'telegram-connect',
  description:
    'Connect to Telegram servers. This is an async operation - returns a request ID. ' +
    'Use telegram-get-result to check the status.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    if (!CONFIG.apiId || !CONFIG.apiHash) {
      return JSON.stringify({ error: 'API credentials not configured. Complete setup first.' });
    }
    const requestId = enqueueRequest('connect', {});
    return JSON.stringify({ status: 'pending', requestId });
  },
};

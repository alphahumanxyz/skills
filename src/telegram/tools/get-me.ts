// Tool: telegram-get-me
// Get information about the authenticated user.

declare const CONFIG: { isAuthenticated: boolean };
declare const CACHE: { me: unknown };
declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramGetMeTool: ToolDefinition = {
  name: 'telegram-get-me',
  description: 'Get information about the authenticated user.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    if (!CONFIG.isAuthenticated) {
      return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
    }
    if (CACHE.me) {
      return JSON.stringify(CACHE.me);
    }
    const requestId = enqueueRequest('get-me', {});
    return JSON.stringify({ status: 'pending', requestId });
  },
};

// Tool: telegram-get-dialogs
// Get the list of dialogs (chats, channels, users).

declare const CONFIG: { isAuthenticated: boolean };
declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramGetDialogsTool: ToolDefinition = {
  name: 'telegram-get-dialogs',
  description:
    'Get the list of dialogs (chats, channels, users). ' +
    'Returns a request ID - use telegram-get-result to check status.',
  input_schema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of dialogs to return (default: 20)' },
    },
  },
  execute(args: Record<string, unknown>): string {
    if (!CONFIG.isAuthenticated) {
      return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
    }
    const limit = (args.limit as number) || 20;
    const requestId = enqueueRequest('get-dialogs', { limit });
    return JSON.stringify({ status: 'pending', requestId });
  },
};

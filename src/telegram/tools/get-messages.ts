// Tool: telegram-get-messages
// Get messages from a chat.

declare const CONFIG: { isAuthenticated: boolean };
declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramGetMessagesTool: ToolDefinition = {
  name: 'telegram-get-messages',
  description:
    'Get messages from a chat. ' +
    'Returns a request ID - use telegram-get-result to check status.',
  input_schema: {
    type: 'object',
    properties: {
      peer: { type: 'string', description: 'Username, phone number, or ID of the chat' },
      limit: { type: 'number', description: 'Maximum number of messages to return (default: 20)' },
    },
    required: ['peer'],
  },
  execute(args: Record<string, unknown>): string {
    if (!CONFIG.isAuthenticated) {
      return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
    }
    const peer = args.peer as string;
    const limit = (args.limit as number) || 20;
    if (!peer) {
      return JSON.stringify({ error: 'Peer is required' });
    }
    const requestId = enqueueRequest('get-messages', { peer, limit });
    return JSON.stringify({ status: 'pending', requestId });
  },
};

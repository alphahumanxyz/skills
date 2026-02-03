// Tool: telegram-send-message
// Send a message to a user, chat, or channel.

declare const CONFIG: { isAuthenticated: boolean };
declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramSendMessageTool: ToolDefinition = {
  name: 'telegram-send-message',
  description:
    'Send a message to a user, chat, or channel. ' +
    'Returns a request ID - use telegram-get-result to check status.',
  input_schema: {
    type: 'object',
    properties: {
      peer: { type: 'string', description: 'Username, phone number, or ID of the recipient' },
      message: { type: 'string', description: 'The message text to send' },
    },
    required: ['peer', 'message'],
  },
  execute(args: Record<string, unknown>): string {
    if (!CONFIG.isAuthenticated) {
      return JSON.stringify({ error: 'Not authenticated. Complete setup first.' });
    }
    const peer = args.peer as string;
    const message = args.message as string;
    if (!peer || !message) {
      return JSON.stringify({ error: 'Both peer and message are required' });
    }
    const requestId = enqueueRequest('send-message', { peer, message });
    return JSON.stringify({ status: 'pending', requestId });
  },
};

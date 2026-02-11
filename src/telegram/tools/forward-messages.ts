// Tool: forward-messages
// Forward messages between Telegram chats.
import * as api from '../api';

export const forwardMessagesToolDefinition: ToolDefinition = {
  name: 'forward-messages',
  description:
    'Forward one or more messages from one Telegram chat to another. ' +
    'The forwarded messages will show the original sender.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: {
        type: 'string',
        description: 'The destination chat ID to forward messages to (required)',
      },
      from_chat_id: {
        type: 'string',
        description: 'The source chat ID to forward messages from (required)',
      },
      message_ids: {
        type: 'string',
        description: 'Comma-separated list of message IDs to forward (required)',
      },
    },
    required: ['chat_id', 'from_chat_id', 'message_ids'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const fromChatId = args.from_chat_id as string;
      const messageIdsStr = args.message_ids as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!fromChatId) return JSON.stringify({ success: false, error: 'from_chat_id is required' });
      if (!messageIdsStr)
        return JSON.stringify({ success: false, error: 'message_ids is required' });

      const messageIds = messageIdsStr.split(',').map(id => parseInt(id.trim(), 10));

      const messages = await api.forwardMessages(
        s.client,
        parseInt(chatId, 10),
        parseInt(fromChatId, 10),
        messageIds
      );

      return JSON.stringify({
        success: true,
        forwarded_count: messages.length,
        messages: messages.map(m => ({ id: m.id, chat_id: m.chat_id, date: m.date })),
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

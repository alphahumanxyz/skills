// Tool: mark-as-read
// Mark messages in a Telegram chat as read.
import * as api from '../api';

export const markAsReadToolDefinition: ToolDefinition = {
  name: 'mark-as-read',
  description:
    'Mark messages in a Telegram chat as read. If no message_ids are provided, ' +
    'marks all messages in the chat as read by reading the latest message.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to mark as read (required)' },
      message_ids: {
        type: 'string',
        description:
          'Comma-separated list of message IDs to mark as read. If omitted, marks latest messages.',
      },
    },
    required: ['chat_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });

      let messageIds: number[];
      if (args.message_ids) {
        messageIds = (args.message_ids as string).split(',').map(id => parseInt(id.trim(), 10));
      } else {
        // Get the latest messages to mark as read
        const history = await api.getChatHistory(s.client, parseInt(chatId, 10), 1);
        if (history.length === 0) {
          return JSON.stringify({ success: true, marked_count: 0 });
        }
        messageIds = [history[0].id];
      }

      await api.viewMessages(s.client, parseInt(chatId, 10), messageIds);

      return JSON.stringify({ success: true, chat_id: chatId, marked_count: messageIds.length });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

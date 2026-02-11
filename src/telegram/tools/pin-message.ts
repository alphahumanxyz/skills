// Tool: pin-message
// Pin or unpin a message in a Telegram chat.
import * as api from '../api';

export const pinMessageToolDefinition: ToolDefinition = {
  name: 'pin-message',
  description:
    'Pin or unpin a message in a Telegram chat. ' +
    'Pinned messages appear at the top of the chat for all members.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      message_id: { type: 'string', description: 'The message ID to pin/unpin (required)' },
      unpin: {
        type: 'string',
        description: 'Set to "true" to unpin instead of pin. Default: false',
        enum: ['true', 'false'],
      },
      disable_notification: {
        type: 'string',
        description: 'Disable notification for pin (true/false). Default: false',
        enum: ['true', 'false'],
      },
    },
    required: ['chat_id', 'message_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const messageId = args.message_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!messageId) return JSON.stringify({ success: false, error: 'message_id is required' });

      const unpin = args.unpin === 'true';
      const disableNotification = args.disable_notification === 'true';

      if (unpin) {
        await api.unpinChatMessage(s.client, parseInt(chatId, 10), parseInt(messageId, 10));
      } else {
        await api.pinChatMessage(
          s.client,
          parseInt(chatId, 10),
          parseInt(messageId, 10),
          disableNotification
        );
      }

      return JSON.stringify({
        success: true,
        action: unpin ? 'unpinned' : 'pinned',
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

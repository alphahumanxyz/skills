// Tool: edit-message
// Edit a sent text message in a Telegram chat.
import * as api from '../api';

export const editMessageToolDefinition: ToolDefinition = {
  name: 'edit-message',
  description:
    'Edit a previously sent text message in a Telegram chat. Only messages sent by you can be edited.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID containing the message (required)' },
      message_id: { type: 'string', description: 'The message ID to edit (required)' },
      text: { type: 'string', description: 'The new message text (required)' },
    },
    required: ['chat_id', 'message_id', 'text'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const messageId = args.message_id as string;
      const text = args.text as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!messageId) return JSON.stringify({ success: false, error: 'message_id is required' });
      if (!text) return JSON.stringify({ success: false, error: 'text is required' });

      const message = await api.editMessageText(
        s.client,
        parseInt(chatId, 10),
        parseInt(messageId, 10),
        text
      );

      return JSON.stringify({
        success: true,
        message: { id: message.id, chat_id: message.chat_id, edit_date: message.edit_date },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

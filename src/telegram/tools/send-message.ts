// Tool: send-message
// Send a text message to a Telegram chat.
import * as api from '../api';

export const sendMessageToolDefinition: ToolDefinition = {
  name: 'send-message',
  description:
    'Send a text message to a Telegram chat. Supports replying to a specific message. ' +
    'Returns the sent message details.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to send the message to (required)' },
      text: { type: 'string', description: 'The message text to send (required)' },
      reply_to_message_id: { type: 'string', description: 'Message ID to reply to (optional)' },
    },
    required: ['chat_id', 'text'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const text = args.text as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!text) return JSON.stringify({ success: false, error: 'text is required' });

      const replyToMessageId = args.reply_to_message_id
        ? parseInt(args.reply_to_message_id as string, 10)
        : undefined;

      const message = await api.sendMessage(s.client, parseInt(chatId, 10), text, replyToMessageId);

      return JSON.stringify({
        success: true,
        message: {
          id: message.id,
          chat_id: message.chat_id,
          date: message.date,
          is_outgoing: message.is_outgoing,
        },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

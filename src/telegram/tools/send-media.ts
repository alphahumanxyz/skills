// Tools: send-photo, send-document
// Send media files to Telegram chats.
import * as api from '../api';

/**
 * Send a photo by remote URL.
 */
export const sendPhotoToolDefinition: ToolDefinition = {
  name: 'send-photo',
  description: 'Send a photo to a Telegram chat by URL. Supports optional caption and reply.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to send the photo to (required)' },
      url: { type: 'string', description: 'The photo URL (required)' },
      caption: { type: 'string', description: 'Optional photo caption' },
      reply_to_message_id: { type: 'string', description: 'Message ID to reply to (optional)' },
    },
    required: ['chat_id', 'url'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const url = args.url as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!url) return JSON.stringify({ success: false, error: 'url is required' });

      const caption = (args.caption as string) || undefined;
      const replyToMessageId = args.reply_to_message_id
        ? parseInt(args.reply_to_message_id as string, 10)
        : undefined;

      const message = await api.sendPhoto(
        s.client,
        parseInt(chatId, 10),
        url,
        caption,
        replyToMessageId
      );

      return JSON.stringify({
        success: true,
        message: { id: message.id, chat_id: message.chat_id, date: message.date },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Send a document/file by remote URL.
 */
export const sendDocumentToolDefinition: ToolDefinition = {
  name: 'send-document',
  description:
    'Send a document or file to a Telegram chat by URL. Supports optional caption and reply.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to send the document to (required)' },
      url: { type: 'string', description: 'The document URL (required)' },
      caption: { type: 'string', description: 'Optional document caption' },
      reply_to_message_id: { type: 'string', description: 'Message ID to reply to (optional)' },
    },
    required: ['chat_id', 'url'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const url = args.url as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!url) return JSON.stringify({ success: false, error: 'url is required' });

      const caption = (args.caption as string) || undefined;
      const replyToMessageId = args.reply_to_message_id
        ? parseInt(args.reply_to_message_id as string, 10)
        : undefined;

      const message = await api.sendDocument(
        s.client,
        parseInt(chatId, 10),
        url,
        caption,
        replyToMessageId
      );

      return JSON.stringify({
        success: true,
        message: { id: message.id, chat_id: message.chat_id, date: message.date },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

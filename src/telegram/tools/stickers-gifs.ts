// Tools: send-sticker, send-gif, search-stickers
// Sticker and GIF operations.
import * as api from '../api';

/**
 * Send a sticker by file ID.
 */
export const sendStickerToolDefinition: ToolDefinition = {
  name: 'send-sticker',
  description:
    'Send a sticker to a Telegram chat by its file ID. Use search-stickers to find sticker IDs.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to send the sticker to (required)' },
      sticker_id: {
        type: 'string',
        description: 'The sticker file ID (required). Get from search-stickers.',
      },
      reply_to_message_id: { type: 'string', description: 'Message ID to reply to (optional)' },
    },
    required: ['chat_id', 'sticker_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const stickerId = args.sticker_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!stickerId) return JSON.stringify({ success: false, error: 'sticker_id is required' });

      const replyToMessageId = args.reply_to_message_id
        ? parseInt(args.reply_to_message_id as string, 10)
        : undefined;

      const message = await api.sendSticker(
        s.client,
        parseInt(chatId, 10),
        stickerId,
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
 * Send a GIF/animation.
 */
export const sendGifToolDefinition: ToolDefinition = {
  name: 'send-gif',
  description: 'Send a GIF/animation to a Telegram chat by URL or file ID.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to send the GIF to (required)' },
      url: { type: 'string', description: 'The GIF URL or file ID (required)' },
      caption: { type: 'string', description: 'Optional caption for the GIF' },
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

      const message = await api.sendAnimation(
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
 * Search for stickers by emoji or keyword.
 */
export const searchStickersToolDefinition: ToolDefinition = {
  name: 'search-stickers',
  description:
    'Search for Telegram stickers by emoji or keyword. Returns sticker file IDs that can be used with send-sticker.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Emoji or keyword to search for stickers (required)' },
      limit: {
        type: 'string',
        description: 'Maximum number of stickers to return (default: 10, max: 20)',
      },
    },
    required: ['query'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const query = args.query as string;
      if (!query) return JSON.stringify({ success: false, error: 'query is required' });

      const limit = Math.min(parseInt((args.limit as string) || '10', 10), 20);

      const result = await api.searchStickers(s.client, query, limit);
      const stickers = (result.stickers || []).map((sticker: Record<string, unknown>) => {
        const stickerFile = sticker.sticker as Record<string, unknown> | undefined;
        const remote = stickerFile?.remote as Record<string, unknown> | undefined;
        return {
          id: remote?.id ?? null,
          emoji: sticker.emoji,
          set_id: sticker.set_id,
          width: sticker.width,
          height: sticker.height,
        };
      });

      return JSON.stringify({ success: true, query, count: stickers.length, stickers });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

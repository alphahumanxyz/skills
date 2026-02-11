// Tools: search-chat-messages, search-messages-global
// Search messages within a chat or across all chats.
import * as api from '../api';
import { isSensitiveText } from '../../helpers';

/**
 * Search messages within a specific chat.
 */
export const searchChatMessagesToolDefinition: ToolDefinition = {
  name: 'search-chat-messages',
  description:
    'Search messages within a specific Telegram chat by keyword. ' +
    'Returns matching messages in reverse chronological order.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to search in (required)' },
      query: { type: 'string', description: 'Search query text (required)' },
      limit: { type: 'string', description: 'Maximum number of results (default: 20, max: 50)' },
      from_message_id: {
        type: 'string',
        description: 'Start searching from this message ID (for pagination)',
      },
    },
    required: ['chat_id', 'query'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const query = args.query as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!query) return JSON.stringify({ success: false, error: 'query is required' });

      const limit = Math.min(parseInt((args.limit as string) || '20', 10), 50);
      const fromMessageId = args.from_message_id ? parseInt(args.from_message_id as string, 10) : 0;

      const messages = await api.searchChatMessages(
        s.client,
        parseInt(chatId, 10),
        query,
        limit,
        fromMessageId
      );

      const showSensitive = s.config.showSensitiveMessages ?? false;
      const formatted = messages
        .map(msg => {
          const text =
            msg.content?.['@type'] === 'messageText'
              ? (msg.content as { text: { text: string } }).text.text
              : null;
          return {
            id: msg.id,
            chat_id: msg.chat_id,
            date: new Date(msg.date * 1000).toISOString(),
            is_outgoing: msg.is_outgoing,
            text,
            content_type: msg.content?.['@type'],
          };
        })
        .filter(msg => showSensitive || !isSensitiveText(msg.text || ''));

      return JSON.stringify({ success: true, query, count: formatted.length, messages: formatted });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Search messages across all chats.
 */
export const searchMessagesGlobalToolDefinition: ToolDefinition = {
  name: 'search-messages-global',
  description:
    'Search messages across all Telegram chats by keyword. ' +
    'Returns matching messages from any conversation.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text (required)' },
      limit: { type: 'string', description: 'Maximum number of results (default: 20, max: 50)' },
    },
    required: ['query'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const query = args.query as string;
      if (!query) return JSON.stringify({ success: false, error: 'query is required' });

      const limit = Math.min(parseInt((args.limit as string) || '20', 10), 50);

      const result = await api.searchMessages(s.client, query, limit);

      const showSensitive = s.config.showSensitiveMessages ?? false;
      const formatted = result.messages
        .map(msg => {
          const text =
            msg.content?.['@type'] === 'messageText'
              ? (msg.content as { text: { text: string } }).text.text
              : null;
          return {
            id: msg.id,
            chat_id: msg.chat_id,
            date: new Date(msg.date * 1000).toISOString(),
            is_outgoing: msg.is_outgoing,
            text,
            content_type: msg.content?.['@type'],
          };
        })
        .filter(msg => showSensitive || !isSensitiveText(msg.text || ''));

      return JSON.stringify({ success: true, query, count: formatted.length, messages: formatted });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

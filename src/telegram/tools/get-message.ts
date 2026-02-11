// Tools: get-message, get-message-link
// Single message retrieval and link generation.
import * as api from '../api';
import { isSensitiveText } from '../../helpers';

/**
 * Get a single message by chat and message ID.
 */
export const getMessageToolDefinition: ToolDefinition = {
  name: 'get-message',
  description:
    'Get a single Telegram message by its chat ID and message ID. ' +
    'Returns the full message content and metadata.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      message_id: { type: 'string', description: 'The message ID (required)' },
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

      const msg = await api.getMessage(s.client, parseInt(chatId, 10), parseInt(messageId, 10));
      if (!msg) return JSON.stringify({ success: false, error: 'Message not found' });

      // Extract text content
      let text: string | null = null;
      if (msg.content?.['@type'] === 'messageText') {
        text = (msg.content as { text: { text: string } }).text.text;
      } else if (
        'caption' in msg.content &&
        (msg.content as { caption?: { text: string } }).caption
      ) {
        text = (msg.content as { caption: { text: string } }).caption.text;
      }

      // Check sensitive filter
      const showSensitive = s.config.showSensitiveMessages ?? false;
      if (!showSensitive && text && isSensitiveText(text)) {
        return JSON.stringify({
          success: true,
          message: {
            id: msg.id,
            chat_id: msg.chat_id,
            date: new Date(msg.date * 1000).toISOString(),
            content_type: msg.content?.['@type'],
            text: '[Sensitive content hidden]',
            is_outgoing: msg.is_outgoing,
          },
        });
      }

      const result: Record<string, unknown> = {
        id: msg.id,
        chat_id: msg.chat_id,
        date: new Date(msg.date * 1000).toISOString(),
        content_type: msg.content?.['@type'],
        is_outgoing: msg.is_outgoing,
        is_pinned: msg.is_pinned,
        can_be_edited: msg.can_be_edited,
      };

      if (text) result.text = text;
      if (msg.edit_date) result.edit_date = new Date(msg.edit_date * 1000).toISOString();
      if (msg.sender_id) {
        result.sender_id = msg.sender_id.user_id ?? msg.sender_id.chat_id;
        result.sender_type = msg.sender_id['@type'] === 'messageSenderUser' ? 'user' : 'chat';
      }
      if (msg.reply_to?.message_id) result.reply_to_message_id = msg.reply_to.message_id;
      if (msg.interaction_info?.view_count) result.views = msg.interaction_info.view_count;
      if (msg.interaction_info?.forward_count) result.forwards = msg.interaction_info.forward_count;

      return JSON.stringify({ success: true, message: result });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Get a shareable link to a message.
 */
export const getMessageLinkToolDefinition: ToolDefinition = {
  name: 'get-message-link',
  description:
    'Get a shareable link to a specific Telegram message. ' +
    'Works for messages in public groups and channels.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      message_id: { type: 'string', description: 'The message ID (required)' },
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

      const result = await api.getMessageLink(
        s.client,
        parseInt(chatId, 10),
        parseInt(messageId, 10)
      );

      if (!result.link) {
        return JSON.stringify({
          success: false,
          error: 'Could not generate message link. The chat may be private.',
        });
      }

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        message_id: messageId,
        link: result.link,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

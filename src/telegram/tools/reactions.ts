// Tools: add-reaction, remove-reaction
// Manage message reactions.
import * as api from '../api';

/**
 * Add a reaction emoji to a message.
 */
export const addReactionToolDefinition: ToolDefinition = {
  name: 'add-reaction',
  description:
    'Add a reaction emoji to a Telegram message. Common reactions: \u{1F44D} \u{2764}\u{FE0F} \u{1F525} \u{1F389} \u{1F62E} \u{1F622} \u{1F4AF} \u{1F44E}',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      message_id: { type: 'string', description: 'The message ID to react to (required)' },
      emoji: { type: 'string', description: 'The reaction emoji (required)' },
    },
    required: ['chat_id', 'message_id', 'emoji'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const messageId = args.message_id as string;
      const emoji = args.emoji as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!messageId) return JSON.stringify({ success: false, error: 'message_id is required' });
      if (!emoji) return JSON.stringify({ success: false, error: 'emoji is required' });

      await api.addMessageReaction(s.client, parseInt(chatId, 10), parseInt(messageId, 10), emoji);

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        message_id: messageId,
        emoji,
        action: 'added',
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
 * Remove a reaction from a message.
 */
export const removeReactionToolDefinition: ToolDefinition = {
  name: 'remove-reaction',
  description: 'Remove a reaction emoji from a Telegram message.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      message_id: { type: 'string', description: 'The message ID (required)' },
      emoji: { type: 'string', description: 'The reaction emoji to remove (required)' },
    },
    required: ['chat_id', 'message_id', 'emoji'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const messageId = args.message_id as string;
      const emoji = args.emoji as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!messageId) return JSON.stringify({ success: false, error: 'message_id is required' });
      if (!emoji) return JSON.stringify({ success: false, error: 'emoji is required' });

      await api.removeMessageReaction(
        s.client,
        parseInt(chatId, 10),
        parseInt(messageId, 10),
        emoji
      );

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        message_id: messageId,
        emoji,
        action: 'removed',
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

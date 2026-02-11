// Tools: set-chat-title, get-chat-invite-link, mute-chat
// Chat management operations.
import * as api from '../api';

/**
 * Set a chat's title.
 */
export const setChatTitleToolDefinition: ToolDefinition = {
  name: 'set-chat-title',
  description: "Change a Telegram group or channel's title. Requires admin privileges.",
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      title: { type: 'string', description: 'The new title (required)' },
    },
    required: ['chat_id', 'title'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const title = args.title as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!title) return JSON.stringify({ success: false, error: 'title is required' });

      await api.setChatTitle(s.client, parseInt(chatId, 10), title);

      return JSON.stringify({ success: true, chat_id: chatId, new_title: title });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Get or create a chat invite link.
 */
export const getChatInviteLinkToolDefinition: ToolDefinition = {
  name: 'get-chat-invite-link',
  description:
    'Get or create an invite link for a Telegram group or channel. Requires admin privileges.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      name: { type: 'string', description: 'Optional name for the invite link' },
      member_limit: {
        type: 'string',
        description: 'Maximum number of members that can join via this link (0 = unlimited)',
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

      const name = (args.name as string) || undefined;
      const memberLimit = args.member_limit ? parseInt(args.member_limit as string, 10) : undefined;

      const result = await api.createChatInviteLink(
        s.client,
        parseInt(chatId, 10),
        name,
        memberLimit
      );

      return JSON.stringify({ success: true, chat_id: chatId, invite_link: result.invite_link });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Mute or unmute a chat.
 */
export const muteChatToolDefinition: ToolDefinition = {
  name: 'mute-chat',
  description:
    "Mute or unmute a Telegram chat's notifications. " +
    'Muting prevents notifications but messages still appear in the chat list.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      mute: {
        type: 'string',
        description: 'Set to "true" to mute, "false" to unmute. Default: true',
        enum: ['true', 'false'],
      },
      duration: {
        type: 'string',
        description:
          'Mute duration in seconds. Use 0 to unmute, 2147483647 for forever. Default: forever.',
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

      const mute = args.mute !== 'false';
      const duration = args.duration
        ? parseInt(args.duration as string, 10)
        : mute
          ? 2147483647
          : 0;

      await api.setChatNotificationSettings(s.client, parseInt(chatId, 10), duration);

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        muted: duration > 0,
        mute_duration: duration,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

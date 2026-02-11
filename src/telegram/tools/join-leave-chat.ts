// Tools: join-chat, leave-chat
// Join or leave Telegram chats.
import * as api from '../api';

/**
 * Join a chat by invite link.
 */
export const joinChatToolDefinition: ToolDefinition = {
  name: 'join-chat',
  description:
    'Join a Telegram chat by invite link (e.g., https://t.me/+abc123 or https://t.me/joinchat/abc123).',
  input_schema: {
    type: 'object',
    properties: { invite_link: { type: 'string', description: 'The chat invite link (required)' } },
    required: ['invite_link'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const inviteLink = args.invite_link as string;
      if (!inviteLink) return JSON.stringify({ success: false, error: 'invite_link is required' });

      const chat = await api.joinChatByInviteLink(s.client, inviteLink);

      return JSON.stringify({
        success: true,
        chat: { id: (chat as { id?: number }).id, title: (chat as { title?: string }).title },
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
 * Leave a group or channel.
 */
export const leaveChatToolDefinition: ToolDefinition = {
  name: 'leave-chat',
  description: 'Leave a Telegram group or channel by chat ID.',
  input_schema: {
    type: 'object',
    properties: { chat_id: { type: 'string', description: 'The chat ID to leave (required)' } },
    required: ['chat_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });

      await api.leaveChat(s.client, parseInt(chatId, 10));

      return JSON.stringify({ success: true, chat_id: chatId, action: 'left' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

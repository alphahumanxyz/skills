// Tool: get-chat
// Get detailed info for a specific Telegram chat.
import * as api from '../api';

export const getChatToolDefinition: ToolDefinition = {
  name: 'get-chat',
  description:
    'Get detailed information about a specific Telegram chat by ID. ' +
    'Returns chat type, title, member count, permissions, and other metadata.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to get info for (required)' },
    },
    required: ['chat_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });

      const chat = await api.getChat(s.client, parseInt(chatId, 10));
      if (!chat) return JSON.stringify({ success: false, error: 'Chat not found' });

      const chatType = chat.type?.['@type'];
      const result: Record<string, unknown> = {
        id: chat.id,
        type: chatType,
        title: chat.title,
        unread_count: chat.unread_count ?? 0,
        unread_mention_count: chat.unread_mention_count ?? 0,
        is_muted: (chat.notification_settings?.mute_for ?? 0) > 0,
      };

      if (chat.permissions) {
        result.permissions = chat.permissions;
      }

      // Get extended info for supergroups/basic groups
      if (chatType === 'chatTypeSupergroup' && chat.type.supergroup_id) {
        const fullInfo = await api.getSupergroupFullInfo(s.client, chat.type.supergroup_id);
        if (fullInfo) {
          result.member_count = fullInfo.member_count;
          result.description = fullInfo.description;
          result.is_channel = chat.type.is_channel ?? false;
          result.invite_link = (fullInfo.invite_link as Record<string, unknown>)?.invite_link;
        }
      } else if (chatType === 'chatTypeBasicGroup' && chat.type.basic_group_id) {
        const fullInfo = await api.getBasicGroupFullInfo(s.client, chat.type.basic_group_id);
        if (fullInfo) {
          result.member_count = (fullInfo.members as unknown[])?.length;
          result.description = fullInfo.description;
          result.invite_link = (fullInfo.invite_link as Record<string, unknown>)?.invite_link;
        }
      } else if (chatType === 'chatTypePrivate' && chat.type.user_id) {
        const user = await api.getUser(s.client, chat.type.user_id);
        if (user) {
          result.user_id = user.id;
          result.username =
            user.usernames?.active_usernames?.[0] ?? user.usernames?.editable_username ?? null;
          result.is_bot = user.type?.['@type'] === 'userTypeBot';
        }
      }

      return JSON.stringify({ success: true, chat: result });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

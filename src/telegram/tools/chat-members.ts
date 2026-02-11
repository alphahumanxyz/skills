// Tools: get-chat-members, add-chat-member, ban-chat-member, promote-chat-member,
//        get-chat-admins, set-chat-permissions
// Group administration and member management.
import * as api from '../api';

/**
 * Get members of a group/channel.
 */
export const getChatMembersToolDefinition: ToolDefinition = {
  name: 'get-chat-members',
  description:
    'Get the members of a Telegram group or channel. Can filter by type (recent, administrators, banned, bots).',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID to get members from (required)' },
      filter: {
        type: 'string',
        description: 'Filter members by type',
        enum: ['recent', 'administrators', 'banned', 'bots', 'restricted'],
      },
      query: { type: 'string', description: 'Search query to filter members by name' },
      limit: {
        type: 'string',
        description: 'Maximum number of members to return (default: 50, max: 200)',
      },
      offset: { type: 'string', description: 'Number of members to skip for pagination' },
    },
    required: ['chat_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });

      const filter = (args.filter as string) || 'recent';
      const query = (args.query as string) || '';
      const limit = Math.min(parseInt((args.limit as string) || '50', 10), 200);

      // Try searchChatMembers first (works for both basic groups and supergroups)
      const result = await api.searchChatMembers(
        s.client,
        parseInt(chatId, 10),
        query,
        limit,
        filter
      );

      const members = (result.members || []).map((member: Record<string, unknown>) => {
        const memberId = member.member_id as Record<string, unknown>;
        return {
          user_id: memberId?.user_id ?? memberId?.chat_id,
          member_type: memberId?.['@type'],
          status: (member.status as Record<string, unknown>)?.['@type'],
          joined_date: member.joined_chat_date,
        };
      });

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        total_count: result.total_count ?? members.length,
        count: members.length,
        members,
        has_more: members.length === limit,
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
 * Add user(s) to a group.
 */
export const addChatMemberToolDefinition: ToolDefinition = {
  name: 'add-chat-member',
  description: 'Add one or more users to a Telegram group. Requires admin privileges in the group.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The group chat ID (required)' },
      user_ids: {
        type: 'string',
        description: 'Comma-separated list of user IDs to add (required)',
      },
    },
    required: ['chat_id', 'user_ids'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const userIdsStr = args.user_ids as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!userIdsStr) return JSON.stringify({ success: false, error: 'user_ids is required' });

      const userIds = userIdsStr.split(',').map(id => parseInt(id.trim(), 10));

      if (userIds.length === 1) {
        await api.addChatMember(s.client, parseInt(chatId, 10), userIds[0]);
      } else {
        await api.addChatMembers(s.client, parseInt(chatId, 10), userIds);
      }

      return JSON.stringify({ success: true, chat_id: chatId, added_count: userIds.length });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Ban a member from a chat.
 */
export const banChatMemberToolDefinition: ToolDefinition = {
  name: 'ban-chat-member',
  description: 'Ban (kick) a member from a Telegram group or channel. Requires admin privileges.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      user_id: { type: 'string', description: 'The user ID to ban (required)' },
    },
    required: ['chat_id', 'user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const userId = args.user_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      await api.banChatMember(s.client, parseInt(chatId, 10), parseInt(userId, 10));

      return JSON.stringify({ success: true, chat_id: chatId, user_id: userId, action: 'banned' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Promote or demote a member (set admin rights).
 */
export const promoteChatMemberToolDefinition: ToolDefinition = {
  name: 'promote-chat-member',
  description:
    'Promote a member to admin or demote an admin in a Telegram group/channel. ' +
    'Specify individual admin rights to grant.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      user_id: { type: 'string', description: 'The user ID to promote/demote (required)' },
      custom_title: { type: 'string', description: 'Custom admin title (optional)' },
      can_manage_chat: {
        type: 'string',
        description: 'Can manage chat settings (true/false)',
        enum: ['true', 'false'],
      },
      can_change_info: {
        type: 'string',
        description: 'Can change chat info (true/false)',
        enum: ['true', 'false'],
      },
      can_post_messages: {
        type: 'string',
        description: 'Can post in channels (true/false)',
        enum: ['true', 'false'],
      },
      can_edit_messages: {
        type: 'string',
        description: 'Can edit messages in channels (true/false)',
        enum: ['true', 'false'],
      },
      can_delete_messages: {
        type: 'string',
        description: 'Can delete messages (true/false)',
        enum: ['true', 'false'],
      },
      can_invite_users: {
        type: 'string',
        description: 'Can invite users (true/false)',
        enum: ['true', 'false'],
      },
      can_restrict_members: {
        type: 'string',
        description: 'Can restrict members (true/false)',
        enum: ['true', 'false'],
      },
      can_pin_messages: {
        type: 'string',
        description: 'Can pin messages (true/false)',
        enum: ['true', 'false'],
      },
      can_promote_members: {
        type: 'string',
        description: 'Can promote other members (true/false)',
        enum: ['true', 'false'],
      },
      demote: {
        type: 'string',
        description: 'Set to "true" to demote to regular member',
        enum: ['true', 'false'],
      },
    },
    required: ['chat_id', 'user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const userId = args.user_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      if (args.demote === 'true') {
        await api.setChatMemberStatus(s.client, parseInt(chatId, 10), parseInt(userId, 10), {
          '@type': 'chatMemberStatusMember',
        });
        return JSON.stringify({
          success: true,
          chat_id: chatId,
          user_id: userId,
          action: 'demoted',
        });
      }

      const rights: Record<string, unknown> = {
        '@type': 'chatMemberStatusAdministrator',
        custom_title: (args.custom_title as string) || '',
        rights: {
          '@type': 'chatAdministratorRights',
          can_manage_chat: args.can_manage_chat === 'true',
          can_change_info: args.can_change_info === 'true',
          can_post_messages: args.can_post_messages === 'true',
          can_edit_messages: args.can_edit_messages === 'true',
          can_delete_messages: args.can_delete_messages === 'true',
          can_invite_users: args.can_invite_users === 'true',
          can_restrict_members: args.can_restrict_members === 'true',
          can_pin_messages: args.can_pin_messages === 'true',
          can_promote_members: args.can_promote_members === 'true',
        },
      };

      await api.setChatMemberStatus(s.client, parseInt(chatId, 10), parseInt(userId, 10), rights);

      return JSON.stringify({
        success: true,
        chat_id: chatId,
        user_id: userId,
        action: 'promoted',
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
 * Get list of chat administrators.
 */
export const getChatAdminsToolDefinition: ToolDefinition = {
  name: 'get-chat-admins',
  description: 'Get the list of administrators for a Telegram group or channel.',
  input_schema: {
    type: 'object',
    properties: { chat_id: { type: 'string', description: 'The chat ID (required)' } },
    required: ['chat_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });

      const result = await api.searchChatMembers(
        s.client,
        parseInt(chatId, 10),
        '',
        200,
        'administrators'
      );

      const admins = (result.members || []).map((member: Record<string, unknown>) => {
        const memberId = member.member_id as Record<string, unknown>;
        const status = member.status as Record<string, unknown>;
        return {
          user_id: memberId?.user_id ?? memberId?.chat_id,
          member_type: memberId?.['@type'],
          status_type: status?.['@type'],
          custom_title: status?.custom_title,
          can_be_edited: status?.can_be_edited,
        };
      });

      return JSON.stringify({ success: true, chat_id: chatId, count: admins.length, admins });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Set default permissions for a group.
 */
export const setChatPermissionsToolDefinition: ToolDefinition = {
  name: 'set-chat-permissions',
  description:
    'Set the default permissions for all members in a Telegram group. ' +
    'Requires admin privileges. Controls what regular (non-admin) members can do.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID (required)' },
      can_send_basic_messages: {
        type: 'string',
        description: 'Can send text messages (true/false)',
        enum: ['true', 'false'],
      },
      can_send_audios: {
        type: 'string',
        description: 'Can send audio (true/false)',
        enum: ['true', 'false'],
      },
      can_send_documents: {
        type: 'string',
        description: 'Can send documents (true/false)',
        enum: ['true', 'false'],
      },
      can_send_photos: {
        type: 'string',
        description: 'Can send photos (true/false)',
        enum: ['true', 'false'],
      },
      can_send_videos: {
        type: 'string',
        description: 'Can send videos (true/false)',
        enum: ['true', 'false'],
      },
      can_send_polls: {
        type: 'string',
        description: 'Can send polls (true/false)',
        enum: ['true', 'false'],
      },
      can_add_link_previews: {
        type: 'string',
        description: 'Can add link previews (true/false)',
        enum: ['true', 'false'],
      },
      can_change_info: {
        type: 'string',
        description: 'Can change chat info (true/false)',
        enum: ['true', 'false'],
      },
      can_invite_users: {
        type: 'string',
        description: 'Can invite users (true/false)',
        enum: ['true', 'false'],
      },
      can_pin_messages: {
        type: 'string',
        description: 'Can pin messages (true/false)',
        enum: ['true', 'false'],
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

      const permissions: Record<string, boolean> = {};
      const fields = [
        'can_send_basic_messages',
        'can_send_audios',
        'can_send_documents',
        'can_send_photos',
        'can_send_videos',
        'can_send_polls',
        'can_add_link_previews',
        'can_change_info',
        'can_invite_users',
        'can_pin_messages',
      ];

      for (const field of fields) {
        if (args[field] !== undefined) {
          permissions[field] = args[field] === 'true';
        }
      }

      await api.setChatPermissions(s.client, parseInt(chatId, 10), permissions);

      return JSON.stringify({ success: true, chat_id: chatId, permissions });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

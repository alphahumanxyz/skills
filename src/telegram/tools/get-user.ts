// Tools: get-user, get-user-profile, search-public-chat
// User lookup and search operations.
import * as api from '../api';

/**
 * Get user info by ID.
 */
export const getUserToolDefinition: ToolDefinition = {
  name: 'get-user',
  description: 'Get basic information about a Telegram user by their user ID.',
  input_schema: {
    type: 'object',
    properties: { user_id: { type: 'string', description: 'The user ID to look up (required)' } },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      const user = await api.getUser(s.client, parseInt(userId, 10));
      if (!user) return JSON.stringify({ success: false, error: 'User not found' });

      const username =
        user.usernames?.active_usernames?.[0] ?? user.usernames?.editable_username ?? null;
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown';

      return JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name,
          first_name: user.first_name,
          last_name: user.last_name ?? null,
          username,
          is_bot: user.type?.['@type'] === 'userTypeBot',
          is_verified: user.is_verified === true,
          is_premium: user.is_premium === true,
          is_contact: user.is_contact === true,
          status: user.status?.['@type'] ?? null,
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

/**
 * Get full user profile (bio, common groups count, etc.).
 */
export const getUserProfileToolDefinition: ToolDefinition = {
  name: 'get-user-profile',
  description:
    'Get the full profile for a Telegram user, including bio, common group count, and other extended info.',
  input_schema: {
    type: 'object',
    properties: { user_id: { type: 'string', description: 'The user ID to look up (required)' } },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      const parsedId = parseInt(userId, 10);
      const user = await api.getUser(s.client, parsedId);
      const fullInfo = await api.getUserFullInfo(s.client, parsedId);

      if (!user) return JSON.stringify({ success: false, error: 'User not found' });

      const username =
        user.usernames?.active_usernames?.[0] ?? user.usernames?.editable_username ?? null;
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown';

      const profile: Record<string, unknown> = {
        id: user.id,
        name,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        username,
        phone_number: user.phone_number ? maskPhone(user.phone_number) : null,
        is_bot: user.type?.['@type'] === 'userTypeBot',
        is_verified: user.is_verified === true,
        is_premium: user.is_premium === true,
        is_contact: user.is_contact === true,
        status: user.status?.['@type'] ?? null,
      };

      if (fullInfo) {
        const bio = fullInfo.bio as Record<string, unknown> | undefined;
        profile.bio = bio?.text ?? null;
        profile.group_in_common_count = fullInfo.group_in_common_count ?? 0;
        profile.is_blocked = fullInfo.is_blocked === true;
      }

      return JSON.stringify({ success: true, profile });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Search for a user/channel/group by @username.
 */
export const searchPublicChatToolDefinition: ToolDefinition = {
  name: 'search-public-chat',
  description:
    'Find a Telegram user, channel, or group by their @username. Returns the matching chat/user info.',
  input_schema: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        description: 'The username to search for, without the @ prefix (required)',
      },
    },
    required: ['username'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      let username = args.username as string;
      if (!username) return JSON.stringify({ success: false, error: 'username is required' });

      // Strip leading @ if present
      if (username.startsWith('@')) username = username.slice(1);

      const result = await api.searchPublicChat(s.client, username);
      if (!result)
        return JSON.stringify({ success: false, error: 'No result found for that username' });

      return JSON.stringify({ success: true, chat: result });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}

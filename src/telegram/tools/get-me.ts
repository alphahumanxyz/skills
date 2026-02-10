// Tool: telegram-get-me
// Get the currently logged-in Telegram user's profile.
import * as api from '../api';

/**
 * Get current user (me) tool definition.
 */
export const getMeToolDefinition: ToolDefinition = {
  name: 'get-me',
  description:
    'Get Telegram user information for the currently logged-in account. Returns profile including name, username, and phone number.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const me = await api.getMe(s.client);

      if (!me) throw new Error('Could not load current user. Try reconnecting Telegram.');

      const username =
        me.usernames?.active_usernames?.[0] ?? me.usernames?.editable_username ?? null;
      const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || 'Unknown';

      const profile = {
        id: me.id,
        name,
        first_name: me.first_name,
        last_name: me.last_name ?? null,
        username,
        phone_number: me.phone_number ?? null,
        is_verified: me.is_verified === true,
        is_premium: me.is_premium === true,
        is_bot: me.type?.['@type'] === 'userTypeBot',
      };

      return JSON.stringify({
        success: true,
        user: profile,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

export default getMeToolDefinition;

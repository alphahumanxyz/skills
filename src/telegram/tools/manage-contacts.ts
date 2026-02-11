// Tools: add-contact, remove-contact, block-user
// Contact and user management operations.
import * as api from '../api';

/**
 * Add a user as a saved contact.
 */
export const addContactToolDefinition: ToolDefinition = {
  name: 'add-contact',
  description: 'Add a Telegram user as a saved contact. Requires the user ID and a first name.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'The user ID to add as contact (required)' },
      first_name: { type: 'string', description: "Contact's first name (required)" },
      last_name: { type: 'string', description: "Contact's last name (optional)" },
      phone_number: { type: 'string', description: "Contact's phone number (optional)" },
    },
    required: ['user_id', 'first_name'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      const firstName = args.first_name as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });
      if (!firstName) return JSON.stringify({ success: false, error: 'first_name is required' });

      await api.addContact(s.client, {
        userId: parseInt(userId, 10),
        firstName,
        lastName: (args.last_name as string) || undefined,
        phoneNumber: (args.phone_number as string) || undefined,
      });

      return JSON.stringify({ success: true, user_id: userId, action: 'added_contact' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Remove a saved contact.
 */
export const removeContactToolDefinition: ToolDefinition = {
  name: 'remove-contact',
  description: 'Remove a Telegram user from your saved contacts.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'The user ID to remove from contacts (required)' },
    },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      await api.removeContacts(s.client, [parseInt(userId, 10)]);

      return JSON.stringify({ success: true, user_id: userId, action: 'removed_contact' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Block or unblock a user.
 */
export const blockUserToolDefinition: ToolDefinition = {
  name: 'block-user',
  description: 'Block or unblock a Telegram user. Blocked users cannot send you messages.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'The user ID to block/unblock (required)' },
      unblock: {
        type: 'string',
        description: 'Set to "true" to unblock instead of block. Default: false',
        enum: ['true', 'false'],
      },
    },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      const unblock = args.unblock === 'true';

      if (unblock) {
        await api.unblockUser(s.client, parseInt(userId, 10));
      } else {
        await api.blockUser(s.client, parseInt(userId, 10));
      }

      return JSON.stringify({
        success: true,
        user_id: userId,
        action: unblock ? 'unblocked' : 'blocked',
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

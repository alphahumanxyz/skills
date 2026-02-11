// Tools: create-private-chat, create-group, create-channel
// Create various types of Telegram chats.
import * as api from '../api';

/**
 * Create a private (DM) chat with a user.
 */
export const createPrivateChatToolDefinition: ToolDefinition = {
  name: 'create-private-chat',
  description:
    'Open or create a direct message conversation with a Telegram user by their user ID.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'The user ID to start a DM with (required)' },
    },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const userId = args.user_id as string;
      if (!userId) return JSON.stringify({ success: false, error: 'user_id is required' });

      const chat = await api.createPrivateChat(s.client, parseInt(userId, 10));

      return JSON.stringify({
        success: true,
        chat: { id: (chat as { id?: number }).id, type: 'private' },
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
 * Create a new group chat.
 */
export const createGroupToolDefinition: ToolDefinition = {
  name: 'create-group',
  description:
    'Create a new Telegram group. Provide a title and at least one user ID to add as a member.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The group title (required)' },
      user_ids: {
        type: 'string',
        description: 'Comma-separated list of user IDs to add to the group (required)',
      },
    },
    required: ['title', 'user_ids'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const title = args.title as string;
      const userIdsStr = args.user_ids as string;
      if (!title) return JSON.stringify({ success: false, error: 'title is required' });
      if (!userIdsStr) return JSON.stringify({ success: false, error: 'user_ids is required' });

      const userIds = userIdsStr.split(',').map(id => parseInt(id.trim(), 10));

      const chat = await api.createNewBasicGroupChat(s.client, userIds, title);

      return JSON.stringify({
        success: true,
        chat: { id: (chat as { id?: number }).id, title, type: 'group' },
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
 * Create a new channel.
 */
export const createChannelToolDefinition: ToolDefinition = {
  name: 'create-channel',
  description:
    'Create a new Telegram channel. Channels are broadcast-only chats where only admins can post.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The channel title (required)' },
      description: { type: 'string', description: 'Channel description (optional)' },
    },
    required: ['title'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const title = args.title as string;
      if (!title) return JSON.stringify({ success: false, error: 'title is required' });

      const description = (args.description as string) || '';

      const chat = await api.createNewSupergroupChat(s.client, title, true, description);

      return JSON.stringify({
        success: true,
        chat: { id: (chat as { id?: number }).id, title, type: 'channel' },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

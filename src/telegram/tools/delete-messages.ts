// Tool: delete-messages
// Delete messages from a Telegram chat.
import * as api from '../api';

export const deleteMessagesToolDefinition: ToolDefinition = {
  name: 'delete-messages',
  description:
    'Delete one or more messages from a Telegram chat. By default deletes for all users (revoke). ' +
    'Pass revoke=false to delete only for yourself.',
  input_schema: {
    type: 'object',
    properties: {
      chat_id: { type: 'string', description: 'The chat ID containing the messages (required)' },
      message_ids: {
        type: 'string',
        description: 'Comma-separated list of message IDs to delete (required)',
      },
      revoke: {
        type: 'string',
        description: 'Delete for all users (true) or only yourself (false). Default: true',
        enum: ['true', 'false'],
      },
    },
    required: ['chat_id', 'message_ids'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const chatId = args.chat_id as string;
      const messageIdsStr = args.message_ids as string;
      if (!chatId) return JSON.stringify({ success: false, error: 'chat_id is required' });
      if (!messageIdsStr)
        return JSON.stringify({ success: false, error: 'message_ids is required' });

      const messageIds = messageIdsStr.split(',').map(id => parseInt(id.trim(), 10));
      const revoke = args.revoke !== 'false';

      await api.deleteMessages(s.client, parseInt(chatId, 10), messageIds, revoke);

      return JSON.stringify({ success: true, deleted_count: messageIds.length, revoked: revoke });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

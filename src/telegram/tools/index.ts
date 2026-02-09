// Export all Telegram tool definitions.
import { getChatStatsToolDefinition } from './get-chat-stats';
import { getChatsToolDefinition } from './get-chats';
import { getContactsToolDefinition } from './get-contacts';
import { getMessagesToolDefinition } from './get-messages';

/**
 * Get all storage-related tool definitions.
 */
export const tools: ToolDefinition[] = [
  getChatsToolDefinition,
  getMessagesToolDefinition,
  getContactsToolDefinition,
  getChatStatsToolDefinition,
];

export default tools;

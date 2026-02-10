// Export all Telegram tool definitions.
import { getChatStatsToolDefinition } from './get-chat-stats';
import { getChatsToolDefinition } from './get-chats';
import { getContactsToolDefinition } from './get-contacts';
import { getMeToolDefinition } from './get-me';
import { getMessagesToolDefinition } from './get-messages';

/**
 * Get all storage-related tool definitions.
 */
export const tools: ToolDefinition[] = [
  getMeToolDefinition,
  getChatsToolDefinition,
  getMessagesToolDefinition,
  getContactsToolDefinition,
  getChatStatsToolDefinition,
];

export default tools;

// Export all Telegram tool definitions.
// Existing tools
// Group admin tools
import {
  addChatMemberToolDefinition,
  banChatMemberToolDefinition,
  getChatAdminsToolDefinition,
  getChatMembersToolDefinition,
  promoteChatMemberToolDefinition,
  setChatPermissionsToolDefinition,
} from './chat-members';
import {
  createChannelToolDefinition,
  createGroupToolDefinition,
  createPrivateChatToolDefinition,
} from './create-chat';
import { deleteMessagesToolDefinition } from './delete-messages';
import { editMessageToolDefinition } from './edit-message';
// Folder management tools
import {
  createChatFolderToolDefinition,
  deleteChatFolderToolDefinition,
  editChatFolderToolDefinition,
  getChatFoldersToolDefinition,
} from './folders';
import { forwardMessagesToolDefinition } from './forward-messages';
// Chat management tools
import { getChatToolDefinition } from './get-chat';
import { getChatStatsToolDefinition } from './get-chat-stats';
import { getChatsToolDefinition } from './get-chats';
import { getContactsToolDefinition } from './get-contacts';
import { getMeToolDefinition } from './get-me';
// Single message tools
import { getMessageLinkToolDefinition, getMessageToolDefinition } from './get-message';
import { getMessagesToolDefinition } from './get-messages';
// User & contact management tools
import {
  getUserProfileToolDefinition,
  getUserToolDefinition,
  searchPublicChatToolDefinition,
} from './get-user';
import { joinChatToolDefinition, leaveChatToolDefinition } from './join-leave-chat';
import {
  getChatInviteLinkToolDefinition,
  muteChatToolDefinition,
  setChatTitleToolDefinition,
} from './manage-chat';
import {
  addContactToolDefinition,
  blockUserToolDefinition,
  removeContactToolDefinition,
} from './manage-contacts';
import { markAsReadToolDefinition } from './mark-as-read';
import { pinMessageToolDefinition } from './pin-message';
// Reaction tools
import { addReactionToolDefinition, removeReactionToolDefinition } from './reactions';
import {
  searchChatMessagesToolDefinition,
  searchMessagesGlobalToolDefinition,
} from './search-messages';
// Media tools
import { sendDocumentToolDefinition, sendPhotoToolDefinition } from './send-media';
// Messaging tools
import { sendMessageToolDefinition } from './send-message';
// Sticker & GIF tools
import {
  searchStickersToolDefinition,
  sendGifToolDefinition,
  sendStickerToolDefinition,
} from './stickers-gifs';

/**
 * Get all storage-related tool definitions.
 */
export const tools: ToolDefinition[] = [
  // Original 5
  getMeToolDefinition,
  getChatsToolDefinition,
  getMessagesToolDefinition,
  getContactsToolDefinition,
  getChatStatsToolDefinition,

  // Messaging (8)
  sendMessageToolDefinition,
  editMessageToolDefinition,
  deleteMessagesToolDefinition,
  forwardMessagesToolDefinition,
  searchChatMessagesToolDefinition,
  searchMessagesGlobalToolDefinition,
  pinMessageToolDefinition,
  markAsReadToolDefinition,

  // Chat management (8)
  getChatToolDefinition,
  createPrivateChatToolDefinition,
  createGroupToolDefinition,
  createChannelToolDefinition,
  joinChatToolDefinition,
  leaveChatToolDefinition,
  setChatTitleToolDefinition,
  getChatInviteLinkToolDefinition,

  // User & contact management (6)
  getUserToolDefinition,
  getUserProfileToolDefinition,
  searchPublicChatToolDefinition,
  addContactToolDefinition,
  removeContactToolDefinition,
  blockUserToolDefinition,

  // Reactions (2)
  addReactionToolDefinition,
  removeReactionToolDefinition,

  // GIFs & stickers (3)
  sendStickerToolDefinition,
  sendGifToolDefinition,
  searchStickersToolDefinition,

  // Folder management (4)
  getChatFoldersToolDefinition,
  createChatFolderToolDefinition,
  editChatFolderToolDefinition,
  deleteChatFolderToolDefinition,

  // Group admin (6)
  getChatMembersToolDefinition,
  addChatMemberToolDefinition,
  banChatMemberToolDefinition,
  promoteChatMemberToolDefinition,
  getChatAdminsToolDefinition,
  setChatPermissionsToolDefinition,

  // Media & misc (5)
  sendPhotoToolDefinition,
  sendDocumentToolDefinition,
  getMessageToolDefinition,
  getMessageLinkToolDefinition,
  muteChatToolDefinition,
];

export default tools;

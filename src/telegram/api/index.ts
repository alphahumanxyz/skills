// Barrel export for the Telegram API layer.
// Each file wraps raw TDLib requests into typed async functions.
export {
  setAuthenticationPhoneNumber,
  checkAuthenticationCode,
  checkAuthenticationPassword,
} from './auth';
export {
  getMe,
  getUser,
  getUserFullInfo,
  getContacts,
  searchPublicChat,
  blockUser,
  unblockUser,
  addContact,
  removeContacts,
} from './users';
export {
  loadChats,
  getChats,
  getChat,
  searchPublicChats,
  searchChats,
  getSupergroupFullInfo,
  getBasicGroupFullInfo,
  createPrivateChat,
  createNewBasicGroupChat,
  createNewSupergroupChat,
  joinChatByInviteLink,
  leaveChat,
  setChatTitle,
  setChatNotificationSettings,
  createChatInviteLink,
  setChatPermissions,
} from './chats';
export {
  getChatHistory,
  getMessage,
  sendMessage,
  searchChatMessages,
  searchMessages,
  forwardMessages,
  viewMessages,
  getChatPinnedMessage,
  editMessageText,
  deleteMessages,
  pinChatMessage,
  unpinChatMessage,
  getMessageLink,
  addMessageReaction,
  removeMessageReaction,
} from './messages';
export {
  getSupergroupMembers,
  searchChatMembers,
  addChatMember,
  addChatMembers,
  banChatMember,
  setChatMemberStatus,
} from './members';
export {
  sendPhoto,
  sendDocument,
  sendSticker,
  sendAnimation,
  searchStickers,
  getStickerSet,
} from './media';
export {
  getChatFolder,
  getChatFolders,
  createChatFolder,
  editChatFolder,
  deleteChatFolder,
  getChatFolderChats,
} from './folders';

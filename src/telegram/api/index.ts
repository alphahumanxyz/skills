// Barrel export for the Telegram API layer.
// Each file wraps raw TDLib requests into typed async functions.
export { getMe, getUser, getUserFullInfo, getContacts, searchPublicChat } from './users';
export {
  loadChats,
  getChats,
  getChat,
  searchPublicChats,
  searchChats,
  getSupergroupFullInfo,
  getBasicGroupFullInfo,
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
} from './messages';

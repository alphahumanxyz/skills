// TDLib update handlers for persisting data to SQLite.
// Each handler processes a specific update type and writes to the database.
// Import db-helpers to initialize globalThis.telegramDb
import './db/helpers';
import type { TdUpdate } from './tdlib-client';
import type {
  TdMessageContent,
  TdUpdateChatFolders,
  TdUpdateChatLastMessage,
  TdUpdateChatPosition,
  TdUpdateChatReadInbox,
  TdUpdateChatTitle,
  TdUpdateChatUnreadMentionCount,
  TdUpdateDeleteMessages,
  TdUpdateMessageContent,
  TdUpdateMessageEdited,
  TdUpdateNewChat,
  TdUpdateNewMessage,
  TdUpdateUser,
  TdUpdateUserStatus,
} from './types';

// ---------------------------------------------------------------------------
// Helper: extract text from TDLib message content
// ---------------------------------------------------------------------------

function extractText(content: TdMessageContent): string {
  if (!content) return '';
  const type = content['@type'];
  if (type === 'messageText') {
    return (content as { '@type': 'messageText'; text: { text: string } }).text?.text ?? '';
  }
  if (
    type === 'messagePhoto' ||
    type === 'messageVideo' ||
    type === 'messageDocument' ||
    type === 'messageAudio' ||
    type === 'messageVoiceNote' ||
    type === 'messageAnimation'
  ) {
    return (content as { caption?: { text: string } }).caption?.text ?? '';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Update Handler Registry
// ---------------------------------------------------------------------------

/**
 * Map of update types to their handlers.
 */
const updateHandlers: Record<string, (update: TdUpdate) => void> = {
  updateNewChat: handleUpdateNewChat,
  updateChatTitle: handleUpdateChatTitle,
  updateChatPosition: handleUpdateChatPosition,
  updateChatLastMessage: handleUpdateChatLastMessage,
  updateChatReadInbox: handleUpdateChatReadInbox,
  updateChatUnreadMentionCount: handleUpdateChatUnreadMentionCount,
  updateChatFolders: handleUpdateChatFolders,
  updateNewMessage: handleUpdateNewMessage,
  updateMessageContent: handleUpdateMessageContent,
  updateMessageEdited: handleUpdateMessageEdited,
  updateDeleteMessages: handleUpdateDeleteMessages,
  updateUser: handleUpdateUser,
  updateUserStatus: handleUpdateUserStatus,
};

/**
 * Main dispatch function for update handling.
 * Returns true if the update was handled, false otherwise.
 */
export function dispatchUpdate(update: TdUpdate): boolean {
  const handler = updateHandlers[update['@type']];
  if (handler) {
    try {
      handler(update);
      return true;
    } catch (err) {
      console.error(`[telegram] Error handling ${update['@type']}:`, err);
      return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Chat Update Handlers
// ---------------------------------------------------------------------------

/**
 * Handle new chat discovery.
 */
function handleUpdateNewChat(update: TdUpdate): void {
  const data = update as unknown as TdUpdateNewChat;
  if (!data.chat) return;

  console.log(`[telegram] New chat: ${data.chat.id} - ${data.chat.title}`);
  globalThis.telegramDb.upsertChat(data.chat);

  // Emit hook event
  const chatType = data.chat.type?.['@type'];
  const isChannel = chatType === 'chatTypeSupergroup' && data.chat.type?.is_channel;
  const entityType = isChannel
    ? 'telegram.channel'
    : chatType === 'chatTypePrivate' || chatType === 'chatTypeSecret'
      ? 'telegram.dm'
      : 'telegram.group';

  hooks.emit({
    type: 'telegram.chat.created',
    source: 'telegram',
    timestamp: Date.now(),
    entities: {
      chat: { type: entityType, id: String(data.chat.id), properties: { title: data.chat.title } },
    },
    data: { chat_id: String(data.chat.id), title: data.chat.title, chat_type: entityType },
  });
}

/**
 * Handle chat title change.
 */
function handleUpdateChatTitle(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatTitle;
  if (!data.chat_id) return;

  console.log(`[telegram] Chat ${data.chat_id} title updated: ${data.title}`);
  globalThis.telegramDb.updateChatTitle(data.chat_id, data.title);
}

/**
 * Handle chat position change (ordering, pinned status).
 */
function handleUpdateChatPosition(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatPosition;
  if (!data.chat_id || !data.position) return;

  globalThis.telegramDb.updateChatPosition(data.chat_id, data.position);
}

/**
 * Handle chat last message update.
 */
function handleUpdateChatLastMessage(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatLastMessage;
  if (!data.chat_id) return;

  globalThis.telegramDb.updateChatLastMessage(data.chat_id, data.last_message, data.positions);
}

/**
 * Handle chat read inbox update (unread count change).
 */
function handleUpdateChatReadInbox(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatReadInbox;
  if (!data.chat_id) return;

  globalThis.telegramDb.updateChatUnreadCount(data.chat_id, data.unread_count);
}

/**
 * Handle chat folders update.
 * Caches folder info list in skill state for use by getChatFolders.
 */
function handleUpdateChatFolders(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatFolders;
  if (!data.chat_folders) return;

  const s = globalThis.getTelegramSkillState();
  s.chatFolderInfos = data.chat_folders;
  console.log(`[telegram] Updated chat folders: ${data.chat_folders.length} folders`);
}

/**
 * Handle chat unread mention count update.
 */
function handleUpdateChatUnreadMentionCount(update: TdUpdate): void {
  const data = update as unknown as TdUpdateChatUnreadMentionCount;
  if (!data.chat_id) return;

  globalThis.telegramDb.updateChatUnreadMentionCount(data.chat_id, data.unread_mention_count);
}

// ---------------------------------------------------------------------------
// Message Update Handlers
// ---------------------------------------------------------------------------

/**
 * Handle new message.
 */
function handleUpdateNewMessage(update: TdUpdate): void {
  const data = update as unknown as TdUpdateNewMessage;
  if (!data.message) return;

  globalThis.telegramDb.upsertMessage(data.message);

  // Emit hook event
  const msg = data.message;
  const entities: Record<string, HookEntityRef> = {
    chat: { type: 'telegram.group', id: String(msg.chat_id) },
  };
  if (msg.sender_id?.user_id) {
    entities.sender = { type: 'telegram.contact', id: String(msg.sender_id.user_id) };
  } else if (msg.sender_id?.chat_id) {
    entities.sender = { type: 'telegram.channel', id: String(msg.sender_id.chat_id) };
  }

  // Detect member join/leave from service messages
  if (msg.content?.['@type'] === 'messageChatAddMembers') {
    const memberIds: number[] =
      (msg.content as { member_user_ids?: number[] }).member_user_ids ?? [];
    for (const memberId of memberIds) {
      hooks.emit({
        type: 'telegram.chat.member_joined',
        source: 'telegram',
        timestamp: Date.now(),
        entities: {
          chat: { type: 'telegram.group', id: String(msg.chat_id) },
          member: { type: 'telegram.contact', id: String(memberId) },
          ...(msg.sender_id?.user_id
            ? { added_by: { type: 'telegram.contact', id: String(msg.sender_id.user_id) } }
            : {}),
        },
        data: {
          chat_id: String(msg.chat_id),
          member_id: String(memberId),
          added_by_id: msg.sender_id?.user_id ? String(msg.sender_id.user_id) : null,
        },
      });
    }
    return;
  }

  if (msg.content?.['@type'] === 'messageChatDeleteMember') {
    const userId = (msg.content as { user_id?: number }).user_id;
    if (userId) {
      hooks.emit({
        type: 'telegram.chat.member_left',
        source: 'telegram',
        timestamp: Date.now(),
        entities: {
          chat: { type: 'telegram.group', id: String(msg.chat_id) },
          member: { type: 'telegram.contact', id: String(userId) },
        },
        data: {
          chat_id: String(msg.chat_id),
          member_id: String(userId),
          removed_by_id: msg.sender_id?.user_id ? String(msg.sender_id.user_id) : null,
        },
      });
    }
    return;
  }

  hooks.emit({
    type: 'telegram.message.received',
    source: 'telegram',
    timestamp: Date.now(),
    entities,
    data: {
      text: extractText(msg.content),
      content_type: msg.content?.['@type'] ?? 'unknown',
      is_outgoing: Boolean(msg.is_outgoing),
      chat_id: String(msg.chat_id),
      message_id: String(msg.id),
    },
  });
}

/**
 * Handle message content update.
 */
function handleUpdateMessageContent(update: TdUpdate): void {
  const data = update as unknown as TdUpdateMessageContent;
  if (!data.chat_id || !data.message_id || !data.new_content) return;

  globalThis.telegramDb.updateMessageContent(data.chat_id, data.message_id, data.new_content);

  // Emit hook event
  hooks.emit({
    type: 'telegram.message.edited',
    source: 'telegram',
    timestamp: Date.now(),
    entities: { chat: { type: 'telegram.group', id: String(data.chat_id) } },
    data: {
      text: extractText(data.new_content),
      content_type: data.new_content['@type'] ?? 'unknown',
      chat_id: String(data.chat_id),
      message_id: String(data.message_id),
    },
  });
}

/**
 * Handle message edit.
 */
function handleUpdateMessageEdited(update: TdUpdate): void {
  const data = update as unknown as TdUpdateMessageEdited;
  if (!data.chat_id || !data.message_id) return;

  globalThis.telegramDb.markMessageEdited(data.chat_id, data.message_id, data.edit_date);
}

/**
 * Handle message deletion.
 */
function handleUpdateDeleteMessages(update: TdUpdate): void {
  const data = update as unknown as TdUpdateDeleteMessages;
  if (!data.chat_id || !data.message_ids || data.message_ids.length === 0) return;

  // Only soft delete if not from cache
  if (!data.from_cache) {
    globalThis.telegramDb.deleteMessages(data.chat_id, data.message_ids);

    // Emit hook event
    hooks.emit({
      type: 'telegram.message.deleted',
      source: 'telegram',
      timestamp: Date.now(),
      entities: { chat: { type: 'telegram.group', id: String(data.chat_id) } },
      data: {
        chat_id: String(data.chat_id),
        message_ids: data.message_ids.map(String),
        is_permanent: Boolean(data.is_permanent),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// User Update Handlers
// ---------------------------------------------------------------------------

/**
 * Handle user update.
 */
function handleUpdateUser(update: TdUpdate): void {
  const data = update as unknown as TdUpdateUser;
  if (!data.user) return;

  globalThis.telegramDb.upsertContact(data.user);
}

/**
 * Handle user status update.
 */
function handleUpdateUserStatus(update: TdUpdate): void {
  const data = update as unknown as TdUpdateUserStatus;
  if (!data.user_id || !data.status) return;

  globalThis.telegramDb.updateUserStatus(data.user_id, data.status);

  // Emit hook event
  hooks.emit({
    type: 'telegram.user.status_changed',
    source: 'telegram',
    timestamp: Date.now(),
    entities: { user: { type: 'telegram.contact', id: String(data.user_id) } },
    data: { user_id: String(data.user_id), status_type: data.status['@type'] },
  });
}

// ---------------------------------------------------------------------------
// GlobalThis Export (workaround for esbuild bundler issue)
// ---------------------------------------------------------------------------

declare global {
  var telegramDispatchUpdate: typeof dispatchUpdate;
}

globalThis.telegramDispatchUpdate = dispatchUpdate;

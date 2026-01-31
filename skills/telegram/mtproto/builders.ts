/**
 * Entity builders — convert raw GramJS objects to typed state objects.
 *
 * Ported from src/lib/telegram/services/entityBuilders.ts.
 */

import type {
  TelegramChat,
  TelegramMessage,
  TelegramUser,
} from "../state/types.js";
import { Api } from "telegram";
import bigInt from "big-integer";
import * as store from "../state/store.js";

// ---------------------------------------------------------------------------
// Peer ID helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPeerId(peer: any): string {
  if (!peer || typeof peer !== "object") return "";
  if (peer.userId != null) return String(peer.userId);
  if (peer.chatId != null) return String(peer.chatId);
  if (peer.channelId != null) return String(peer.channelId);
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChatType(entity: any): TelegramChat["type"] {
  if (!entity) return "private";
  const className: string = entity.className ?? "";
  if (className === "Channel") {
    return entity.megagroup ? "supergroup" : "channel";
  }
  if (className === "Chat" || className === "ChatForbidden") {
    return "group";
  }
  return "private";
}

// ---------------------------------------------------------------------------
// Chat builder
// ---------------------------------------------------------------------------

export function buildChat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialog: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: any,
  lastMsg?: TelegramMessage,
): TelegramChat {
  const id = buildPeerId(dialog.peer ?? entity);
  const type = getChatType(entity);

  const chat: TelegramChat = {
    id,
    type,
    unreadCount: dialog.unreadCount ?? 0,
    isPinned: Boolean(dialog.pinned),
  };

  if (type === "private") {
    const firstName: string = entity?.firstName ?? "";
    const lastName: string = entity?.lastName ?? "";
    chat.title =
      [firstName, lastName].filter(Boolean).join(" ") || `User ${id}`;
  } else {
    chat.title = entity?.title ?? `Chat ${id}`;
  }

  if (entity?.username) chat.username = entity.username;
  if (entity?.accessHash != null) {
    chat.accessHash = String(entity.accessHash);
  }
  if (entity?.photo && entity.photo.className !== "ChatPhotoEmpty") {
    chat.photo = {
      smallFileId: entity.photo.photoId
        ? String(entity.photo.photoId)
        : undefined,
    };
  }
  if (entity?.participantsCount != null) {
    chat.participantsCount = entity.participantsCount;
  }
  if (lastMsg) {
    chat.lastMessage = lastMsg;
    chat.lastMessageDate = lastMsg.date;
  }

  return chat;
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMessage(msg: any, fallbackChatId?: string): TelegramMessage | null {
  if (!msg || typeof msg !== "object") return null;
  if (msg.id === undefined || msg.id === null) return null;

  let chatId = fallbackChatId ?? "";
  if (msg.peerId) {
    chatId = buildPeerId(msg.peerId) || chatId;
  }

  const telegramMsg: TelegramMessage = {
    id: String(msg.id),
    chatId,
    date: typeof msg.date === "number" ? msg.date : 0,
    message: typeof msg.message === "string" ? msg.message : "",
    isOutgoing: Boolean(msg.out),
    isEdited: Boolean(msg.editDate),
    isForwarded: Boolean(msg.fwdFrom),
  };

  if (msg.fromId && typeof msg.fromId === "object") {
    telegramMsg.fromId = buildPeerId(msg.fromId);
  }

  if (msg.replyTo && typeof msg.replyTo === "object") {
    if (msg.replyTo.replyToMsgId) {
      telegramMsg.replyToMessageId = String(msg.replyTo.replyToMsgId);
    }
    if (msg.replyTo.replyToTopId) {
      telegramMsg.threadId = String(msg.replyTo.replyToTopId);
    }
  }

  if (msg.media && typeof msg.media === "object") {
    const className = (msg.media.constructor as { className?: string })
      ?.className;
    telegramMsg.media = { type: className ?? "unknown" };
  }

  if (typeof msg.views === "number") {
    telegramMsg.views = msg.views;
  }

  return telegramMsg;
}

// ---------------------------------------------------------------------------
// User builder
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildUser(user: any): TelegramUser {
  if (!user || typeof user !== "object" || user.id == null) {
    return {
      id: "0",
      firstName: "Unknown",
    };
  }

  return {
    id: String(user.id),
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? undefined,
    username: user.username ?? undefined,
    phoneNumber: user.phone ?? undefined,
    isBot: Boolean(user.bot),
    isVerified: user.verified ? true : undefined,
    isPremium: user.premium ? true : undefined,
    accessHash: user.accessHash != null ? String(user.accessHash) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Entity map builder
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEntityMap(result: any): Map<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();

  const users: unknown[] = result?.users ?? [];
  const chats: unknown[] = result?.chats ?? [];

  for (const u of users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = u as any;
    if (user?.id != null) map.set(String(user.id), user);
  }

  for (const c of chats) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chat = c as any;
    if (chat?.id != null) map.set(String(chat.id), chat);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Type cast / input helpers
// ---------------------------------------------------------------------------

/**
 * Convert a string channel ID to an InputChannel.
 * Looks up access hash from the store if available.
 */
export function toInputChannel(chatId: string): Api.InputChannel {
  const chat = store.getChatById(chatId);
  const accessHash = chat?.accessHash ? bigInt(chat.accessHash) : bigInt.zero;
  return new Api.InputChannel({
    channelId: bigInt(chatId),
    accessHash,
  });
}

/**
 * Convert a string user ID to an InputUser.
 * Looks up access hash from the store if available.
 */
export function toInputUser(userId: string): Api.InputUser {
  const user = store.getUser(userId);
  const accessHash = user?.accessHash ? bigInt(user.accessHash) : bigInt.zero;
  return new Api.InputUser({
    userId: bigInt(userId),
    accessHash,
  });
}

/**
 * Convert a string ID to an InputPeer.
 * Type hint controls the peer type (default: channel).
 */
export function toInputPeer(id: string, type?: string): Api.TypeInputPeer {
  if (type === "user") {
    const user = store.getUser(id);
    const accessHash = user?.accessHash ? bigInt(user.accessHash) : bigInt.zero;
    return new Api.InputPeerUser({
      userId: bigInt(id),
      accessHash,
    });
  }
  // Default to channel
  const chat = store.getChatById(id);
  const accessHash = chat?.accessHash ? bigInt(chat.accessHash) : bigInt.zero;
  return new Api.InputPeerChannel({
    channelId: bigInt(id),
    accessHash,
  });
}

/**
 * Narrow a GramJS result to a specific type.
 */
export function narrow<T extends object>(result: object): T {
  return result as T;
}

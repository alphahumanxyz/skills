/**
 * In-process state store for the Telegram runtime skill.
 *
 * Uses plain objects (no Zustand — that runs in the main app).
 * State mutations are synchronous. After each mutation, a summary
 * is pushed to the host via reverse RPC.
 */

import type {
  TelegramState,
  TelegramChat,
  TelegramMessage,
  TelegramUser,
  TelegramThread,
  TelegramConnectionStatus,
  TelegramAuthStatus,
} from "./types.js";
import { initialState } from "./types.js";

let state: TelegramState = { ...initialState };

/** Listeners notified on every state change */
const listeners: Array<() => void> = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getState(): TelegramState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(): void {
  for (const fn of listeners) fn();
}

// ---------------------------------------------------------------------------
// Connection / Auth
// ---------------------------------------------------------------------------

export function setConnectionStatus(status: TelegramConnectionStatus): void {
  state = { ...state, connectionStatus: status };
  if (status !== "error") state.connectionError = null;
  notify();
}

export function setConnectionError(error: string | null): void {
  state = { ...state, connectionError: error };
  if (error) state.connectionStatus = "error";
  notify();
}

export function setAuthStatus(status: TelegramAuthStatus): void {
  state = { ...state, authStatus: status };
  if (status !== "error") state.authError = null;
  notify();
}

export function setAuthError(error: string | null): void {
  state = { ...state, authError: error };
  if (error) state.authStatus = "error";
  notify();
}

export function setSessionString(sessionString: string | null): void {
  state = { ...state, sessionString };
  notify();
}

export function setIsInitialized(value: boolean): void {
  state = { ...state, isInitialized: value };
  notify();
}

export function setCurrentUser(user: TelegramUser | null): void {
  state = { ...state, currentUser: user };
  notify();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function addUsers(users: Record<string, TelegramUser>): void {
  state = { ...state, users: { ...state.users, ...users } };
  notify();
}

export function getUser(userId: string): TelegramUser | undefined {
  return state.users[userId];
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

export function replaceChats(
  chats: Record<string, TelegramChat>,
  chatsOrder: string[],
): void {
  state = { ...state, chats, chatsOrder };
  notify();
}

export function addChats(
  chatsOrRecord: TelegramChat[] | Record<string, TelegramChat>,
  appendOrder?: string[],
): void {
  let chatRecord: Record<string, TelegramChat>;
  let orderIds: string[];

  if (Array.isArray(chatsOrRecord)) {
    chatRecord = {};
    orderIds = [];
    for (const c of chatsOrRecord) {
      chatRecord[c.id] = c;
      orderIds.push(c.id);
    }
  } else {
    chatRecord = chatsOrRecord;
    orderIds = appendOrder ?? Object.keys(chatsOrRecord);
  }

  const newChats = { ...state.chats, ...chatRecord };
  const existing = new Set(state.chatsOrder);
  const newOrder = [...state.chatsOrder];
  for (const id of orderIds) {
    if (!existing.has(id)) {
      newOrder.push(id);
      existing.add(id);
    }
  }
  state = { ...state, chats: newChats, chatsOrder: newOrder };
  notify();
}

export function addChat(chat: TelegramChat): void {
  const chats = { ...state.chats, [chat.id]: chat };
  const chatsOrder = state.chatsOrder.includes(chat.id)
    ? state.chatsOrder
    : [chat.id, ...state.chatsOrder];
  state = { ...state, chats, chatsOrder };
  notify();
}

export function updateChat(id: string, updates: Partial<TelegramChat>): void {
  if (!state.chats[id]) return;
  state = {
    ...state,
    chats: { ...state.chats, [id]: { ...state.chats[id], ...updates } },
  };
  notify();
}

export function getChatById(
  chatId: string | number,
): TelegramChat | undefined {
  const idStr = String(chatId);
  const chat = state.chats[idStr];
  if (chat) return chat;

  if (
    typeof chatId === "string" &&
    (chatId.startsWith("@") || /^[a-zA-Z0-9_]+$/.test(chatId))
  ) {
    const username = chatId.startsWith("@") ? chatId : `@${chatId}`;
    return Object.values(state.chats).find(
      (c) =>
        c.username &&
        (c.username === username || c.username === username.slice(1)),
    );
  }

  return undefined;
}

export function getOrderedChats(limit = 20): TelegramChat[] {
  return state.chatsOrder
    .map((id) => state.chats[id])
    .filter(Boolean)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function addMessages(
  chatId: string,
  messages: TelegramMessage[],
): void {
  const byId = { ...(state.messages[chatId] ?? {}) };
  const order = [...(state.messagesOrder[chatId] ?? [])];
  const existing = new Set(order);

  for (const msg of messages) {
    byId[msg.id] = msg;
    if (!existing.has(msg.id)) {
      order.push(msg.id);
      existing.add(msg.id);
    }
  }

  // Sort by date
  order.sort((a, b) => {
    const ma = byId[a];
    const mb = byId[b];
    if (!ma || !mb) return 0;
    return ma.date - mb.date;
  });

  state = {
    ...state,
    messages: { ...state.messages, [chatId]: byId },
    messagesOrder: { ...state.messagesOrder, [chatId]: order },
  };
  notify();
}

export function getCachedMessages(
  chatId: string,
  limit = 20,
  offset = 0,
): TelegramMessage[] | undefined {
  const order = state.messagesOrder[chatId] ?? [];
  const byId = state.messages[chatId] ?? {};
  const all = order.map((id) => byId[id]).filter(Boolean);
  const list = all.slice(offset, offset + limit);
  return list.length ? list : undefined;
}

export function updateMessage(
  chatId: string,
  messageId: string,
  updates: Partial<TelegramMessage>,
): void {
  const msg = state.messages[chatId]?.[messageId];
  if (!msg) return;
  state = {
    ...state,
    messages: {
      ...state.messages,
      [chatId]: {
        ...state.messages[chatId],
        [messageId]: { ...msg, ...updates },
      },
    },
  };
  notify();
}

export function deleteMessages(chatId: string, messageIds: string[]): void {
  const toDelete = new Set(messageIds);
  const byId = { ...(state.messages[chatId] ?? {}) };
  for (const id of messageIds) delete byId[id];
  const order = (state.messagesOrder[chatId] ?? []).filter(
    (id) => !toDelete.has(id),
  );
  state = {
    ...state,
    messages: { ...state.messages, [chatId]: byId },
    messagesOrder: { ...state.messagesOrder, [chatId]: order },
  };
  notify();
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export function addThread(thread: TelegramThread): void {
  const { chatId, id } = thread;
  const chatThreads = { ...(state.threads[chatId] ?? {}), [id]: thread };
  const chatOrder = state.threadsOrder[chatId] ?? [];
  const newOrder = chatOrder.includes(id) ? chatOrder : [...chatOrder, id];
  state = {
    ...state,
    threads: { ...state.threads, [chatId]: chatThreads },
    threadsOrder: { ...state.threadsOrder, [chatId]: newOrder },
  };
  notify();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function removeChat(chatId: string): void {
  const chats = { ...state.chats };
  delete chats[chatId];
  const chatsOrder = state.chatsOrder.filter((id) => id !== chatId);
  state = { ...state, chats, chatsOrder };
  notify();
}

export function removeMessage(chatId: string, messageId: number | string): void {
  const msgId = String(messageId);
  const byId = { ...(state.messages[chatId] ?? {}) };
  delete byId[msgId];
  const order = (state.messagesOrder[chatId] ?? []).filter((id) => id !== msgId);
  state = {
    ...state,
    messages: { ...state.messages, [chatId]: byId },
    messagesOrder: { ...state.messagesOrder, [chatId]: order },
  };
  notify();
}

export function searchChatsInCache(query: string): TelegramChat[] {
  const q = query.toLowerCase();
  return getOrderedChats(9999).filter((c) => {
    const title = (c.title ?? "").toLowerCase();
    const un = (c.username ?? "").toLowerCase();
    return title.includes(q) || un.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

export function setSyncStatus(
  isSyncing?: boolean,
  isSynced?: boolean,
): void {
  const updates: Partial<TelegramState> = {};
  if (isSyncing !== undefined) updates.isSyncing = isSyncing;
  if (isSynced !== undefined) updates.isSynced = isSynced;
  state = { ...state, ...updates };
  notify();
}

export function setLoadingChats(value: boolean): void {
  state = { ...state, isLoadingChats: value };
  notify();
}

export function setLoadingMessages(value: boolean): void {
  state = { ...state, isLoadingMessages: value };
  notify();
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

export function resetState(): void {
  state = { ...initialState };
  notify();
}

/**
 * Telegram state types for the runtime skill.
 *
 * Ported from src/lib/telegram/state/types.ts.
 * These types are used in-process by the skill and a summary
 * is pushed to the host via reverse RPC for React UI consumption.
 */

export type TelegramConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type TelegramAuthStatus =
  | "not_authenticated"
  | "authenticating"
  | "authenticated"
  | "error";

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  isBot: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  accessHash?: string;
}

export interface TelegramChat {
  id: string;
  title?: string;
  type: "private" | "group" | "supergroup" | "channel";
  username?: string;
  accessHash?: string;
  unreadCount: number;
  lastMessage?: TelegramMessage;
  lastMessageDate?: number;
  isPinned: boolean;
  photo?: {
    smallFileId?: string;
    bigFileId?: string;
  };
  participantsCount?: number;
}

export interface TelegramMessage {
  id: string;
  chatId: string;
  threadId?: string;
  date: number;
  message: string;
  fromId?: string;
  fromName?: string;
  isOutgoing: boolean;
  isEdited: boolean;
  isForwarded: boolean;
  replyToMessageId?: string;
  media?: {
    type: string;
    [key: string]: unknown;
  };
  reactions?: Array<{
    emoticon: string;
    count: number;
  }>;
  views?: number;
}

export interface TelegramThread {
  id: string;
  chatId: string;
  title: string;
  messageCount: number;
  lastMessage?: TelegramMessage;
  lastMessageDate?: number;
  unreadCount: number;
  isPinned: boolean;
}

/** Default key for the main (non-threaded) conversation */
export const MAIN_THREAD_ID = "__main__";

export interface TelegramState {
  // Connection state
  connectionStatus: TelegramConnectionStatus;
  connectionError: string | null;

  // Authentication state
  authStatus: TelegramAuthStatus;
  authError: string | null;
  isInitialized: boolean;
  phoneNumber: string | null;
  sessionString: string | null;

  // Sync state
  isSyncing: boolean;
  isSynced: boolean;

  // User data
  currentUser: TelegramUser | null;

  // Users map (all known users from chats/messages)
  users: Record<string, TelegramUser>;

  // Chats
  chats: Record<string, TelegramChat>;
  chatsOrder: string[];
  selectedChatId: string | null;

  // Messages — Normalized storage
  messages: Record<string, Record<string, TelegramMessage>>;
  messagesOrder: Record<string, string[]>;

  // Threads
  threads: Record<string, Record<string, TelegramThread>>;
  threadsOrder: Record<string, string[]>;
  selectedThreadId: string | null;

  // Loading states
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isLoadingThreads: boolean;

  // Pagination
  hasMoreChats: boolean;
  hasMoreMessages: Record<string, boolean>;
  hasMoreThreads: Record<string, boolean>;

  // Search
  searchQuery: string | null;
  filteredChatIds: string[] | null;
}

export const initialState: TelegramState = {
  connectionStatus: "disconnected",
  connectionError: null,
  authStatus: "not_authenticated",
  authError: null,
  isInitialized: false,
  phoneNumber: null,
  sessionString: null,
  isSyncing: false,
  isSynced: false,
  currentUser: null,
  users: {},
  chats: {},
  chatsOrder: [],
  selectedChatId: null,
  messages: {},
  messagesOrder: {},
  threads: {},
  threadsOrder: {},
  selectedThreadId: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  isLoadingThreads: false,
  hasMoreChats: true,
  hasMoreMessages: {},
  hasMoreThreads: {},
  searchQuery: null,
  filteredChatIds: null,
};

/**
 * Host state — what gets pushed to the host via state/set for React UI consumption.
 * Subset of TelegramState (messages are too large to push).
 */
export interface TelegramHostState {
  connectionStatus: TelegramConnectionStatus;
  authStatus: TelegramAuthStatus;
  isInitialized: boolean;
  currentUser: TelegramUser | null;
  chatsOrder: string[];
  chats: Record<string, TelegramChat>;
  totalUnread: number;
}

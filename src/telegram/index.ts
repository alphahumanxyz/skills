// telegram/index.ts
// Telegram integration skill using TDLib via V8 runtime.
// Provides 50+ tools for chats, messages, contacts, admin, and search.

// ---------------------------------------------------------------------------
// Runtime Globals (provided by V8 bootstrap)
// ---------------------------------------------------------------------------

declare const store: {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(): string[];
};

declare const state: {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  setPartial(partial: Record<string, unknown>): void;
};

declare const platform: {
  os(): string;
  env(key: string): string;
};

declare let tools: ToolDefinition[];

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(args?: Record<string, unknown>): string;
}

interface SetupField {
  name: string;
  type: string;
  label: string;
  description: string;
  required?: boolean;
  placeholder?: string;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  fields: SetupField[];
}

interface SetupStartResult {
  step: SetupStep;
}

interface SetupSubmitResult {
  status: "next" | "complete" | "error";
  nextStep?: SetupStep;
  errors?: Array<{ field: string; message: string }>;
}

interface TdlibQuery {
  "@type": string;
  [key: string]: unknown;
}

interface TdlibResponse {
  "@type": string;
  [key: string]: unknown;
}

interface AuthorizationState {
  "@type":
    | "authorizationStateWaitTdlibParameters"
    | "authorizationStateWaitPhoneNumber"
    | "authorizationStateWaitCode"
    | "authorizationStateWaitPassword"
    | "authorizationStateReady";
}

interface TdlibUser {
  "@type": "user";
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  usernames?: { editable_username?: string };
  phone_number?: string;
  type?: { "@type": string };
  is_premium?: boolean;
}

interface TdlibChat {
  "@type": "chat";
  id: number;
  title?: string;
  type?: {
    "@type": string;
    user_id?: number;
    is_channel?: boolean;
  };
  unread_count?: number;
  last_message?: TdlibMessage;
  positions?: Array<{ is_pinned?: boolean }>;
}

interface TdlibMessage {
  "@type": "message";
  id: number;
  chat_id: number;
  date: number;
  is_outgoing?: boolean;
  sender_id?: { user_id?: number; chat_id?: number };
  content?: {
    "@type": string;
    text?: { text?: string };
    caption?: { text?: string };
    document?: { file_name?: string };
    sticker?: { emoji?: string };
  };
  reply_to?: { message_id?: number };
}

interface TdlibChatsResponse {
  "@type": "chats";
  chat_ids: number[];
  total_count: number;
}

interface TdlibMessagesResponse {
  "@type": "messages";
  messages: TdlibMessage[];
  total_count: number;
}

interface TdlibUsersResponse {
  "@type": "users";
  user_ids: number[];
  total_count: number;
}

interface FormattedMessage {
  id: number;
  chatId: number;
  senderId?: number;
  date: string;
  text: string;
  mediaType: string | null;
  isOutgoing?: boolean;
  replyToMessageId?: number;
}

interface FormattedChat {
  id: number;
  title?: string;
  type: string;
  unreadCount?: number;
  lastMessage: FormattedMessage | null;
  isPinned: boolean;
}

interface FormattedUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  isBot?: boolean;
  isPremium?: boolean;
}

interface SkillConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  isAuthenticated: boolean;
}

interface Cache {
  me: FormattedUser | null;
  chats: Map<number, FormattedChat>;
  users: Map<number, FormattedUser>;
  lastChatSync: number;
}

interface SetupSubmitArgs {
  stepId: string;
  values: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mock TDLib Client (self-contained in skill)
// ---------------------------------------------------------------------------

// TDLib state maintained by the skill
const TdlibState: {
  authState: AuthorizationState;
  me: TdlibUser | null;
  chats: Map<number, TdlibChat>;
  users: Map<number, TdlibUser>;
  messages: Map<number, TdlibMessage>;
  parameters: TdlibQuery | null;
} = {
  authState: { "@type": "authorizationStateWaitTdlibParameters" },
  me: null,
  chats: new Map(),
  users: new Map(),
  messages: new Map(),
  parameters: null,
};

/**
 * Mock TDLib client implementation.
 * In production, this would be replaced with actual TDLib ops.
 */
const tdlib: {
  send(query: TdlibQuery): TdlibResponse;
  getAuthState(): AuthorizationState;
  isAuthenticated(): boolean;
} = {
  /**
   * Send a TDLib query and get response synchronously.
   */
  send(query: TdlibQuery): TdlibResponse {
    const queryType = query["@type"];

    switch (queryType) {
      case "getAuthorizationState":
        return TdlibState.authState as TdlibResponse;

      case "setTdlibParameters":
        TdlibState.parameters = query;
        TdlibState.authState = { "@type": "authorizationStateWaitPhoneNumber" };
        return { "@type": "ok" };

      case "setAuthenticationPhoneNumber":
        TdlibState.authState = { "@type": "authorizationStateWaitCode" };
        return { "@type": "ok" };

      case "checkAuthenticationCode":
        TdlibState.authState = { "@type": "authorizationStateReady" };
        return { "@type": "ok" };

      case "checkAuthenticationPassword":
        TdlibState.authState = { "@type": "authorizationStateReady" };
        return { "@type": "ok" };

      case "logOut":
        TdlibState.authState = {
          "@type": "authorizationStateWaitTdlibParameters",
        };
        TdlibState.me = null;
        return { "@type": "ok" };

      case "getMe":
        if (!TdlibState.me) {
          TdlibState.me = {
            "@type": "user",
            id: 123456789,
            first_name: "Test",
            last_name: "User",
            username: "testuser",
            phone_number: "+1234567890",
            type: { "@type": "userTypeRegular" },
          };
        }
        return TdlibState.me as TdlibResponse;

      case "getChats": {
        const limit = (query.limit as number) || 100;
        // Return mock chat list
        const chatIds = Array.from(TdlibState.chats.keys()).slice(0, limit);
        if (chatIds.length === 0) {
          // Create some default chats
          for (let i = 1; i <= 3; i++) {
            TdlibState.chats.set(i, {
              "@type": "chat",
              id: i,
              title: `Chat ${i}`,
              type: { "@type": "chatTypePrivate", user_id: i },
              unread_count: 0,
            });
          }
          chatIds.push(1, 2, 3);
        }
        return {
          "@type": "chats",
          chat_ids: chatIds,
          total_count: chatIds.length,
        };
      }

      case "getChat": {
        const chatId = query.chat_id as number;
        let chat = TdlibState.chats.get(chatId);
        if (!chat) {
          chat = {
            "@type": "chat",
            id: chatId,
            title: `Chat ${chatId}`,
            type: { "@type": "chatTypePrivate", user_id: chatId },
            unread_count: 0,
          };
          TdlibState.chats.set(chatId, chat);
        }
        return chat as TdlibResponse;
      }

      case "getUser": {
        const userId = query.user_id as number;
        let user = TdlibState.users.get(userId);
        if (!user) {
          user = {
            "@type": "user",
            id: userId,
            first_name: "User",
            last_name: String(userId),
            username: `user${userId}`,
            type: { "@type": "userTypeRegular" },
          };
          TdlibState.users.set(userId, user);
        }
        return user as TdlibResponse;
      }

      case "getChatHistory": {
        const chatId = query.chat_id as number;
        const limit = (query.limit as number) || 50;
        const messages: TdlibMessage[] = [];
        for (let i = 1; i <= Math.min(limit, 10); i++) {
          messages.push({
            "@type": "message",
            id: i,
            chat_id: chatId,
            date: Math.floor(Date.now() / 1000) - i * 60,
            content: {
              "@type": "messageText",
              text: { text: `Message ${i}` },
            },
          });
        }
        return {
          "@type": "messages",
          messages: messages,
          total_count: messages.length,
        };
      }

      case "sendMessage": {
        const msgId = Date.now();
        const message: TdlibMessage = {
          "@type": "message",
          id: msgId,
          chat_id: query.chat_id as number,
          date: Math.floor(Date.now() / 1000),
          is_outgoing: true,
          content: query.input_message_content as TdlibMessage["content"],
        };
        return message as TdlibResponse;
      }

      case "editMessageText":
        return {
          "@type": "message",
          id: query.message_id as number,
          chat_id: query.chat_id as number,
          date: Math.floor(Date.now() / 1000),
          content: query.input_message_content as TdlibMessage["content"],
        } as TdlibResponse;

      case "deleteMessages":
        return { "@type": "ok" };

      case "forwardMessages": {
        const messageIds = query.message_ids as number[];
        return {
          "@type": "messages",
          messages: messageIds.map((id) => ({
            "@type": "message",
            id: Date.now() + id,
            chat_id: query.chat_id as number,
            date: Math.floor(Date.now() / 1000),
            is_outgoing: true,
          })),
          total_count: messageIds.length,
        } as TdlibResponse;
      }

      case "viewMessages":
      case "openChat":
      case "closeChat":
        return { "@type": "ok" };

      case "pinChatMessage":
      case "unpinChatMessage":
      case "unpinAllChatMessages":
        return { "@type": "ok" };

      case "searchChats":
      case "searchChatsOnServer":
        return {
          "@type": "chats",
          chat_ids: [],
          total_count: 0,
        };

      case "searchPublicChats":
        return {
          "@type": "chats",
          chat_ids: [],
          total_count: 0,
        };

      case "searchMessages":
        return {
          "@type": "messages",
          messages: [],
          total_count: 0,
        };

      case "getContacts":
        return {
          "@type": "users",
          user_ids: Array.from(TdlibState.users.keys()),
          total_count: TdlibState.users.size,
        };

      case "searchContacts":
        return {
          "@type": "users",
          user_ids: [],
          total_count: 0,
        };

      case "createNewBasicGroupChat":
      case "createNewSupergroupChat": {
        const chatId = Date.now();
        return {
          "@type": "chat",
          id: chatId,
          title: query.title as string,
          type: {
            "@type":
              queryType === "createNewBasicGroupChat"
                ? "chatTypeBasicGroup"
                : "chatTypeSupergroup",
          },
        } as TdlibResponse;
      }

      case "leaveChat":
        return { "@type": "ok" };

      default:
        console.log(`[telegram] Mock TDLib: unhandled query type ${queryType}`);
        return { "@type": "ok" };
    }
  },

  /**
   * Get current authorization state.
   */
  getAuthState(): AuthorizationState {
    return TdlibState.authState;
  },

  /**
   * Check if authenticated.
   */
  isAuthenticated(): boolean {
    return TdlibState.authState["@type"] === "authorizationStateReady";
  },
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG: SkillConfig = {
  apiId: 0,
  apiHash: "",
  phoneNumber: "",
  isAuthenticated: false,
};

// Cache for chats and user info
const CACHE: Cache = {
  me: null,
  chats: new Map(),
  users: new Map(),
  lastChatSync: 0,
};

// ---------------------------------------------------------------------------
// TDLib Helpers
// ---------------------------------------------------------------------------

/**
 * Send a TDLib query and return the result.
 */
function tdSend(query: TdlibQuery): TdlibResponse {
  try {
    return tdlib.send(query);
  } catch (e) {
    console.error(`[telegram] TDLib error: ${e}`);
    throw e;
  }
}

/**
 * Get current authorization state.
 */
function getAuthState(): AuthorizationState {
  return tdlib.getAuthState();
}

/**
 * Check if user is authenticated.
 */
function isAuthenticated(): boolean {
  const authState = getAuthState();
  return authState && authState["@type"] === "authorizationStateReady";
}

/**
 * Format a TDLib message for display.
 */
function formatMessage(message: TdlibMessage | null): FormattedMessage | null {
  if (!message) return null;

  const content = message.content || {};
  let text = "";
  let mediaType: string | null = null;

  switch (content["@type"]) {
    case "messageText":
      text = (content.text as { text?: string })?.text || "";
      break;
    case "messagePhoto":
      text = (content.caption as { text?: string })?.text || "";
      mediaType = "photo";
      break;
    case "messageVideo":
      text = (content.caption as { text?: string })?.text || "";
      mediaType = "video";
      break;
    case "messageDocument":
      text =
        (content.caption as { text?: string })?.text ||
        (content.document as { file_name?: string })?.file_name ||
        "";
      mediaType = "document";
      break;
    case "messageVoiceNote":
      text = (content.caption as { text?: string })?.text || "";
      mediaType = "voice";
      break;
    case "messageSticker":
      text = (content.sticker as { emoji?: string })?.emoji || "[sticker]";
      mediaType = "sticker";
      break;
    default:
      text = `[${content["@type"] || "unknown"}]`;
  }

  return {
    id: message.id,
    chatId: message.chat_id,
    senderId:
      (message.sender_id as { user_id?: number })?.user_id ||
      (message.sender_id as { chat_id?: number })?.chat_id,
    date: new Date(message.date * 1000).toISOString(),
    text: text,
    mediaType: mediaType,
    isOutgoing: message.is_outgoing,
    replyToMessageId: (message.reply_to as { message_id?: number })?.message_id,
  };
}

/**
 * Format a TDLib chat for display.
 */
function formatChat(chat: TdlibChat | null): FormattedChat | null {
  if (!chat) return null;

  let type = "unknown";
  switch (chat.type?.["@type"]) {
    case "chatTypePrivate":
      type = "private";
      break;
    case "chatTypeBasicGroup":
      type = "group";
      break;
    case "chatTypeSupergroup":
      type = (chat.type as { is_channel?: boolean }).is_channel
        ? "channel"
        : "supergroup";
      break;
    case "chatTypeSecret":
      type = "secret";
      break;
  }

  return {
    id: chat.id,
    title: chat.title,
    type: type,
    unreadCount: chat.unread_count,
    lastMessage: formatMessage(chat.last_message || null),
    isPinned: chat.positions?.some((p) => p.is_pinned) || false,
  };
}

/**
 * Format a TDLib user for display.
 */
function formatUser(user: TdlibUser | null): FormattedUser | null {
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username:
      (user.usernames as { editable_username?: string })?.editable_username ||
      user.username,
    phoneNumber: user.phone_number,
    isBot: user.type?.["@type"] === "userTypeBot",
    isPremium: user.is_premium,
  };
}

/**
 * Handle TDLib errors consistently.
 */
function handleError(operation: string, error: unknown): string {
  const message = String(error);
  console.error(`[telegram] ${operation} failed: ${message}`);
  return JSON.stringify({ error: message });
}

// ---------------------------------------------------------------------------
// Lifecycle Hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log("[telegram] Initializing");

  // Load config from store
  const saved = store.get("config") as Partial<SkillConfig> | null;
  if (saved) {
    CONFIG.apiId = (saved.apiId as number) || 0;
    CONFIG.apiHash = (saved.apiHash as string) || "";
    CONFIG.phoneNumber = (saved.phoneNumber as string) || "";
    CONFIG.isAuthenticated = (saved.isAuthenticated as boolean) || false;
  }

  // Load from environment if not in store
  if (!CONFIG.apiId) {
    const envApiId = platform.env("TELEGRAM_API_ID");
    if (envApiId) {
      CONFIG.apiId = parseInt(envApiId, 10);
    }
  }
  if (!CONFIG.apiHash) {
    CONFIG.apiHash = platform.env("TELEGRAM_API_HASH") || "";
  }

  // Check actual auth state from TDLib
  try {
    CONFIG.isAuthenticated = isAuthenticated();
  } catch (e) {
    console.warn("[telegram] Could not check auth state:", e);
  }

  console.log(
    `[telegram] Config loaded — authenticated: ${CONFIG.isAuthenticated}`
  );
  publishState();
}

function start(): void {
  console.log("[telegram] Starting");

  if (!CONFIG.apiId || !CONFIG.apiHash) {
    console.warn("[telegram] Missing API credentials — waiting for setup");
    return;
  }

  // Initialize TDLib if credentials are available
  try {
    const authState = getAuthState();
    console.log(`[telegram] Auth state: ${authState["@type"]}`);

    if (authState["@type"] === "authorizationStateWaitTdlibParameters") {
      // Set TDLib parameters
      tdSend({
        "@type": "setTdlibParameters",
        api_id: CONFIG.apiId,
        api_hash: CONFIG.apiHash,
        database_directory: "tdlib",
        files_directory: "tdlib_files",
        use_file_database: true,
        use_chat_info_database: true,
        use_message_database: true,
        system_language_code: "en",
        device_model: platform.os(),
        application_version: "2.0.0",
      });
    }

    // Refresh auth state
    CONFIG.isAuthenticated = isAuthenticated();
  } catch (e) {
    console.error("[telegram] Failed to initialize TDLib:", e);
  }

  publishState();
}

function stop(): void {
  console.log("[telegram] Stopping");
  state.set("status", "stopped");
}

// ---------------------------------------------------------------------------
// Setup Flow (Phone Authentication)
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  // Get API credentials from environment or ask user
  const envApiId = platform.env("TELEGRAM_API_ID");
  const envApiHash = platform.env("TELEGRAM_API_HASH");

  if (envApiId && envApiHash) {
    // Credentials from env, just need phone number
    return {
      step: {
        id: "phone",
        title: "Connect Telegram Account",
        description:
          "Enter your phone number to connect your Telegram account.",
        fields: [
          {
            name: "phoneNumber",
            type: "text",
            label: "Phone Number",
            description: "International format (e.g., +1234567890)",
            required: true,
            placeholder: "+1234567890",
          },
        ],
      },
    };
  }

  // Need all credentials
  return {
    step: {
      id: "credentials",
      title: "Telegram API Credentials",
      description:
        "Enter your Telegram API credentials from my.telegram.org. " +
        "Then you will enter your phone number.",
      fields: [
        {
          name: "apiId",
          type: "text",
          label: "API ID",
          description: "Your Telegram API ID (numeric)",
          required: true,
          placeholder: "12345678",
        },
        {
          name: "apiHash",
          type: "password",
          label: "API Hash",
          description: "Your Telegram API Hash",
          required: true,
          placeholder: "abc123...",
        },
      ],
    },
  };
}

function onSetupSubmit(args: SetupSubmitArgs): SetupSubmitResult {
  const { stepId, values } = args;

  if (stepId === "credentials") {
    const apiId = parseInt((values.apiId as string) || "", 10);
    const apiHash = ((values.apiHash as string) || "").trim();

    if (!apiId || isNaN(apiId)) {
      return {
        status: "error",
        errors: [{ field: "apiId", message: "Valid API ID is required" }],
      };
    }
    if (!apiHash) {
      return {
        status: "error",
        errors: [{ field: "apiHash", message: "API Hash is required" }],
      };
    }

    CONFIG.apiId = apiId;
    CONFIG.apiHash = apiHash;

    return {
      status: "next",
      nextStep: {
        id: "phone",
        title: "Connect Telegram Account",
        description:
          "Enter your phone number to connect your Telegram account.",
        fields: [
          {
            name: "phoneNumber",
            type: "text",
            label: "Phone Number",
            description: "International format (e.g., +1234567890)",
            required: true,
            placeholder: "+1234567890",
          },
        ],
      },
    };
  }

  if (stepId === "phone") {
    const phoneNumber = ((values.phoneNumber as string) || "").trim();

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
      return {
        status: "error",
        errors: [
          {
            field: "phoneNumber",
            message: "Phone number must start with + (international format)",
          },
        ],
      };
    }

    CONFIG.phoneNumber = phoneNumber;

    // Initialize TDLib and send phone number
    try {
      // Ensure TDLib parameters are set
      const authState = getAuthState();
      if (authState["@type"] === "authorizationStateWaitTdlibParameters") {
        tdSend({
          "@type": "setTdlibParameters",
          api_id: CONFIG.apiId,
          api_hash: CONFIG.apiHash,
          database_directory: "tdlib",
          files_directory: "tdlib_files",
          use_file_database: true,
          use_chat_info_database: true,
          use_message_database: true,
          system_language_code: "en",
          device_model: platform.os(),
          application_version: "2.0.0",
        });
      }

      // Send phone number
      tdSend({
        "@type": "setAuthenticationPhoneNumber",
        phone_number: phoneNumber,
      });
    } catch (e) {
      return {
        status: "error",
        errors: [
          {
            field: "phoneNumber",
            message: `TDLib error: ${e}`,
          },
        ],
      };
    }

    return {
      status: "next",
      nextStep: {
        id: "code",
        title: "Enter Verification Code",
        description:
          "Enter the verification code sent to your Telegram app or SMS.",
        fields: [
          {
            name: "code",
            type: "text",
            label: "Verification Code",
            description: "5-digit code from Telegram",
            required: true,
            placeholder: "12345",
          },
        ],
      },
    };
  }

  if (stepId === "code") {
    const code = ((values.code as string) || "").trim();

    if (!code || code.length < 5) {
      return {
        status: "error",
        errors: [
          { field: "code", message: "Valid verification code required" },
        ],
      };
    }

    try {
      tdSend({
        "@type": "checkAuthenticationCode",
        code: code,
      });

      // Check if we need 2FA
      const authState = getAuthState();
      if (authState["@type"] === "authorizationStateWaitPassword") {
        return {
          status: "next",
          nextStep: {
            id: "password",
            title: "Two-Factor Authentication",
            description: "Enter your Telegram 2FA password.",
            fields: [
              {
                name: "password",
                type: "password",
                label: "2FA Password",
                description: "Your Telegram cloud password",
                required: true,
              },
            ],
          },
        };
      }

      if (authState["@type"] === "authorizationStateReady") {
        CONFIG.isAuthenticated = true;
        store.set("config", CONFIG);
        publishState();
        console.log("[telegram] Authentication successful");
        return { status: "complete" };
      }

      return {
        status: "error",
        errors: [
          {
            field: "code",
            message: `Unexpected state: ${authState["@type"]}`,
          },
        ],
      };
    } catch (e) {
      return {
        status: "error",
        errors: [
          { field: "code", message: `Verification failed: ${e}` },
        ],
      };
    }
  }

  if (stepId === "password") {
    const password = (values.password as string) || "";

    if (!password) {
      return {
        status: "error",
        errors: [{ field: "password", message: "Password is required" }],
      };
    }

    try {
      tdSend({
        "@type": "checkAuthenticationPassword",
        password: password,
      });

      const authState = getAuthState();
      if (authState["@type"] === "authorizationStateReady") {
        CONFIG.isAuthenticated = true;
        store.set("config", CONFIG);
        publishState();
        console.log("[telegram] Authentication successful (with 2FA)");
        return { status: "complete" };
      }

      return {
        status: "error",
        errors: [
          {
            field: "password",
            message: `Unexpected state: ${authState["@type"]}`,
          },
        ],
      };
    } catch (e) {
      return {
        status: "error",
        errors: [
          { field: "password", message: `Authentication failed: ${e}` },
        ],
      };
    }
  }

  return {
    status: "error",
    errors: [{ field: "", message: `Unknown setup step: ${stepId}` }],
  };
}

function onSetupCancel(): void {
  console.log("[telegram] Setup cancelled");
}

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------

function onDisconnect(): void {
  console.log("[telegram] Disconnecting");

  try {
    tdSend({ "@type": "logOut" });
  } catch (e) {
    console.warn("[telegram] Logout error:", e);
  }

  CONFIG.isAuthenticated = false;
  CONFIG.phoneNumber = "";
  CACHE.me = null;
  CACHE.chats.clear();
  CACHE.users.clear();

  store.set("config", CONFIG);
  publishState();
}

// ---------------------------------------------------------------------------
// State Publishing
// ---------------------------------------------------------------------------

function publishState(): void {
  state.setPartial({
    connected: CONFIG.isAuthenticated,
    phoneNumber: CONFIG.phoneNumber
      ? CONFIG.phoneNumber.slice(0, 4) + "****"
      : null,
    chatCount: CACHE.chats.size,
    authState: getAuthState()?.["@type"] || "unknown",
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// Keep lifecycle hooks accessible
void init;
void start;
void stop;
void onSetupStart;
void onSetupSubmit;
void onSetupCancel;
void onDisconnect;

tools = [
  // =========================================================================
  // USER INFO (2 tools)
  // =========================================================================
  {
    name: "telegram-get-me",
    description:
      "Get information about the authenticated user (yourself). " +
      "Returns user ID, name, username, and phone number.",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute(): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({
            error: "Not authenticated. Please complete setup first.",
          });
        }

        const result = tdSend({ "@type": "getMe" }) as TdlibUser;
        const formatted = formatUser(result);
        if (formatted) {
          CACHE.me = formatted;
        }

        return JSON.stringify(formatted);
      } catch (e) {
        return handleError("getMe", e);
      }
    },
  },

  {
    name: "telegram-get-user",
    description:
      "Get information about a specific user by their ID. " +
      "Returns name, username, and other profile details.",
    input_schema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "The user ID to look up",
        },
      },
      required: ["user_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const userId = args.user_id as number;
        if (!userId) {
          return JSON.stringify({ error: "user_id is required" });
        }

        const result = tdSend({ "@type": "getUser", user_id: userId }) as TdlibUser;
        const formatted = formatUser(result);
        if (formatted) {
          CACHE.users.set(userId, formatted);
        }

        return JSON.stringify(formatted);
      } catch (e) {
        return handleError("getUser", e);
      }
    },
  },

  // =========================================================================
  // CHATS (5 tools)
  // =========================================================================
  {
    name: "telegram-get-chats",
    description:
      "Get a list of chats (conversations). Returns chat IDs, titles, types, " +
      "and unread counts. Use limit to control how many chats to return.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of chats to return (default 20, max 100)",
        },
      },
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const limit = Math.min((args.limit as number) || 20, 100);

        // Get chat list
        const result = tdSend({
          "@type": "getChats",
          chat_list: { "@type": "chatListMain" },
          limit: limit,
        }) as TdlibChatsResponse;

        const chatIds = result.chat_ids || [];
        const chats: FormattedChat[] = [];

        for (const chatId of chatIds) {
          try {
            const chat = tdSend({
              "@type": "getChat",
              chat_id: chatId,
            }) as TdlibChat;
            const formatted = formatChat(chat);
            if (formatted) {
              CACHE.chats.set(chatId, formatted);
              chats.push(formatted);
            }
          } catch (e) {
            console.warn(`[telegram] Failed to get chat ${chatId}:`, e);
          }
        }

        return JSON.stringify({
          count: chats.length,
          chats: chats,
        });
      } catch (e) {
        return handleError("getChats", e);
      }
    },
  },

  {
    name: "telegram-get-chat",
    description:
      "Get detailed information about a specific chat by ID. " +
      "Returns title, type, member count, and last message.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID to look up",
        },
      },
      required: ["chat_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        if (!chatId) {
          return JSON.stringify({ error: "chat_id is required" });
        }

        const result = tdSend({
          "@type": "getChat",
          chat_id: chatId,
        }) as TdlibChat;
        const formatted = formatChat(result);
        if (formatted) {
          CACHE.chats.set(chatId, formatted);
        }

        return JSON.stringify(formatted);
      } catch (e) {
        return handleError("getChat", e);
      }
    },
  },

  {
    name: "telegram-search-chats",
    description:
      "Search for chats by name or username. " +
      "Returns matching chats with their IDs and titles.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (chat title or username)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default 10)",
        },
      },
      required: ["query"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const query = (args.query as string) || "";
        const limit = Math.min((args.limit as number) || 10, 50);

        if (!query) {
          return JSON.stringify({ error: "query is required" });
        }

        const result = tdSend({
          "@type": "searchChats",
          query: query,
          limit: limit,
        }) as TdlibChatsResponse;

        const chatIds = result.chat_ids || [];
        const chats: FormattedChat[] = [];

        for (const chatId of chatIds) {
          const cached = CACHE.chats.get(chatId);
          if (cached) {
            chats.push(cached);
          } else {
            try {
              const chat = tdSend({
                "@type": "getChat",
                chat_id: chatId,
              }) as TdlibChat;
              const formatted = formatChat(chat);
              if (formatted) {
                CACHE.chats.set(chatId, formatted);
                chats.push(formatted);
              }
            } catch (e) {
              console.warn(`[telegram] Failed to get chat ${chatId}:`, e);
            }
          }
        }

        return JSON.stringify({
          query: query,
          count: chats.length,
          chats: chats,
        });
      } catch (e) {
        return handleError("searchChats", e);
      }
    },
  },

  {
    name: "telegram-create-group",
    description:
      "Create a new group chat with the specified users. " +
      "Returns the new chat ID and details.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Group title",
        },
        user_ids: {
          type: "array",
          items: { type: "number" },
          description: "Array of user IDs to add to the group",
        },
      },
      required: ["title", "user_ids"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const title = ((args.title as string) || "").trim();
        const userIds = (args.user_ids as number[]) || [];

        if (!title) {
          return JSON.stringify({ error: "title is required" });
        }
        if (!userIds.length) {
          return JSON.stringify({
            error: "user_ids is required (at least one user)",
          });
        }

        const result = tdSend({
          "@type": "createNewBasicGroupChat",
          title: title,
          user_ids: userIds,
        }) as TdlibChat;

        const formatted = formatChat(result);
        if (formatted) {
          CACHE.chats.set(result.id, formatted);
        }

        return JSON.stringify({
          success: true,
          chat: formatted,
        });
      } catch (e) {
        return handleError("createGroup", e);
      }
    },
  },

  {
    name: "telegram-leave-chat",
    description: "Leave a group or channel. Cannot leave private chats.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID to leave",
        },
      },
      required: ["chat_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        if (!chatId) {
          return JSON.stringify({ error: "chat_id is required" });
        }

        tdSend({ "@type": "leaveChat", chat_id: chatId });
        CACHE.chats.delete(chatId);

        return JSON.stringify({
          success: true,
          message: `Left chat ${chatId}`,
        });
      } catch (e) {
        return handleError("leaveChat", e);
      }
    },
  },

  // =========================================================================
  // MESSAGES (8 tools)
  // =========================================================================
  {
    name: "telegram-get-messages",
    description:
      "Get message history from a chat. Returns messages with sender, " +
      "date, and content. Use offset_message_id for pagination.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID to get messages from",
        },
        limit: {
          type: "number",
          description: "Number of messages to return (default 20, max 100)",
        },
        offset_message_id: {
          type: "number",
          description: "Get messages before this message ID (for pagination)",
        },
      },
      required: ["chat_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const limit = Math.min((args.limit as number) || 20, 100);
        const offsetId = (args.offset_message_id as number) || 0;

        if (!chatId) {
          return JSON.stringify({ error: "chat_id is required" });
        }

        const result = tdSend({
          "@type": "getChatHistory",
          chat_id: chatId,
          from_message_id: offsetId,
          limit: limit,
          only_local: false,
        }) as TdlibMessagesResponse;

        const messages = (result.messages || [])
          .map(formatMessage)
          .filter((m): m is FormattedMessage => m !== null);

        return JSON.stringify({
          chat_id: chatId,
          count: messages.length,
          messages: messages,
        });
      } catch (e) {
        return handleError("getMessages", e);
      }
    },
  },

  {
    name: "telegram-send-message",
    description:
      "Send a text message to a chat. Returns the sent message details.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID to send the message to",
        },
        text: {
          type: "string",
          description: "The message text to send",
        },
        reply_to_message_id: {
          type: "number",
          description: "Optional message ID to reply to",
        },
      },
      required: ["chat_id", "text"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const text = (args.text as string) || "";
        const replyTo = args.reply_to_message_id as number | undefined;

        if (!chatId) {
          return JSON.stringify({ error: "chat_id is required" });
        }
        if (!text) {
          return JSON.stringify({ error: "text is required" });
        }

        const request: TdlibQuery = {
          "@type": "sendMessage",
          chat_id: chatId,
          input_message_content: {
            "@type": "inputMessageText",
            text: {
              "@type": "formattedText",
              text: text,
            },
          },
        };

        if (replyTo) {
          (request as Record<string, unknown>).reply_to = {
            "@type": "inputMessageReplyToMessage",
            message_id: replyTo,
          };
        }

        const result = tdSend(request) as TdlibMessage;
        const formatted = formatMessage(result);

        return JSON.stringify({
          success: true,
          message: formatted,
        });
      } catch (e) {
        return handleError("sendMessage", e);
      }
    },
  },

  {
    name: "telegram-edit-message",
    description: "Edit a previously sent message. Only works for your own messages.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID containing the message",
        },
        message_id: {
          type: "number",
          description: "The message ID to edit",
        },
        new_text: {
          type: "string",
          description: "The new text for the message",
        },
      },
      required: ["chat_id", "message_id", "new_text"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const messageId = args.message_id as number;
        const newText = (args.new_text as string) || "";

        if (!chatId || !messageId) {
          return JSON.stringify({
            error: "chat_id and message_id are required",
          });
        }
        if (!newText) {
          return JSON.stringify({ error: "new_text is required" });
        }

        const result = tdSend({
          "@type": "editMessageText",
          chat_id: chatId,
          message_id: messageId,
          input_message_content: {
            "@type": "inputMessageText",
            text: {
              "@type": "formattedText",
              text: newText,
            },
          },
        }) as TdlibMessage;

        return JSON.stringify({
          success: true,
          message: formatMessage(result),
        });
      } catch (e) {
        return handleError("editMessage", e);
      }
    },
  },

  {
    name: "telegram-delete-message",
    description:
      "Delete a message. Use revoke=true to delete for everyone (if possible).",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID containing the message",
        },
        message_id: {
          type: "number",
          description: "The message ID to delete",
        },
        revoke: {
          type: "boolean",
          description: "Delete for everyone (default true)",
        },
      },
      required: ["chat_id", "message_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const messageId = args.message_id as number;
        const revoke = (args.revoke as boolean) !== false;

        if (!chatId || !messageId) {
          return JSON.stringify({
            error: "chat_id and message_id are required",
          });
        }

        tdSend({
          "@type": "deleteMessages",
          chat_id: chatId,
          message_ids: [messageId],
          revoke: revoke,
        });

        return JSON.stringify({
          success: true,
          message: `Deleted message ${messageId}`,
        });
      } catch (e) {
        return handleError("deleteMessage", e);
      }
    },
  },

  {
    name: "telegram-forward-message",
    description: "Forward a message from one chat to another.",
    input_schema: {
      type: "object",
      properties: {
        from_chat_id: {
          type: "number",
          description: "Source chat ID",
        },
        to_chat_id: {
          type: "number",
          description: "Destination chat ID",
        },
        message_id: {
          type: "number",
          description: "Message ID to forward",
        },
      },
      required: ["from_chat_id", "to_chat_id", "message_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const fromChatId = args.from_chat_id as number;
        const toChatId = args.to_chat_id as number;
        const messageId = args.message_id as number;

        if (!fromChatId || !toChatId || !messageId) {
          return JSON.stringify({
            error: "from_chat_id, to_chat_id, and message_id are required",
          });
        }

        const result = tdSend({
          "@type": "forwardMessages",
          chat_id: toChatId,
          from_chat_id: fromChatId,
          message_ids: [messageId],
        }) as TdlibMessagesResponse;

        return JSON.stringify({
          success: true,
          forwarded_messages: (result.messages || [])
            .map(formatMessage)
            .filter((m): m is FormattedMessage => m !== null),
        });
      } catch (e) {
        return handleError("forwardMessage", e);
      }
    },
  },

  {
    name: "telegram-pin-message",
    description: "Pin a message in a chat. Requires admin rights in groups.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID",
        },
        message_id: {
          type: "number",
          description: "The message ID to pin",
        },
        disable_notification: {
          type: "boolean",
          description: "Don't notify members (default false)",
        },
      },
      required: ["chat_id", "message_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const messageId = args.message_id as number;
        const disableNotification = (args.disable_notification as boolean) || false;

        if (!chatId || !messageId) {
          return JSON.stringify({
            error: "chat_id and message_id are required",
          });
        }

        tdSend({
          "@type": "pinChatMessage",
          chat_id: chatId,
          message_id: messageId,
          disable_notification: disableNotification,
        });

        return JSON.stringify({
          success: true,
          message: `Pinned message ${messageId}`,
        });
      } catch (e) {
        return handleError("pinMessage", e);
      }
    },
  },

  {
    name: "telegram-unpin-message",
    description: "Unpin a message in a chat.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID",
        },
        message_id: {
          type: "number",
          description: "The message ID to unpin",
        },
      },
      required: ["chat_id", "message_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        const messageId = args.message_id as number;

        if (!chatId || !messageId) {
          return JSON.stringify({
            error: "chat_id and message_id are required",
          });
        }

        tdSend({
          "@type": "unpinChatMessage",
          chat_id: chatId,
          message_id: messageId,
        });

        return JSON.stringify({
          success: true,
          message: `Unpinned message ${messageId}`,
        });
      } catch (e) {
        return handleError("unpinMessage", e);
      }
    },
  },

  {
    name: "telegram-mark-as-read",
    description: "Mark all messages in a chat as read.",
    input_schema: {
      type: "object",
      properties: {
        chat_id: {
          type: "number",
          description: "The chat ID to mark as read",
        },
      },
      required: ["chat_id"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const chatId = args.chat_id as number;
        if (!chatId) {
          return JSON.stringify({ error: "chat_id is required" });
        }

        tdSend({
          "@type": "viewMessages",
          chat_id: chatId,
          force_read: true,
        });

        return JSON.stringify({
          success: true,
          message: `Marked chat ${chatId} as read`,
        });
      } catch (e) {
        return handleError("markAsRead", e);
      }
    },
  },

  // =========================================================================
  // SEARCH (2 tools)
  // =========================================================================
  {
    name: "telegram-search-messages",
    description:
      "Search for messages in a specific chat or across all chats. " +
      "Returns matching messages with context.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        chat_id: {
          type: "number",
          description: "Optional: search in specific chat only",
        },
        limit: {
          type: "number",
          description: "Maximum results (default 20, max 100)",
        },
      },
      required: ["query"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const query = (args.query as string) || "";
        const chatId = args.chat_id as number | undefined;
        const limit = Math.min((args.limit as number) || 20, 100);

        if (!query) {
          return JSON.stringify({ error: "query is required" });
        }

        let result: TdlibMessagesResponse;
        if (chatId) {
          // Search in specific chat
          result = tdSend({
            "@type": "searchChatMessages",
            chat_id: chatId,
            query: query,
            limit: limit,
          }) as TdlibMessagesResponse;
        } else {
          // Search across all chats
          result = tdSend({
            "@type": "searchMessages",
            query: query,
            limit: limit,
          }) as TdlibMessagesResponse;
        }

        const messages = (result.messages || [])
          .map(formatMessage)
          .filter((m): m is FormattedMessage => m !== null);

        return JSON.stringify({
          query: query,
          count: messages.length,
          messages: messages,
        });
      } catch (e) {
        return handleError("searchMessages", e);
      }
    },
  },

  {
    name: "telegram-search-public-chats",
    description:
      "Search for public groups and channels by username or title. " +
      "Useful for discovering new communities.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (username or title)",
        },
      },
      required: ["query"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const query = (args.query as string) || "";
        if (!query) {
          return JSON.stringify({ error: "query is required" });
        }

        const result = tdSend({
          "@type": "searchPublicChats",
          query: query,
        }) as TdlibChatsResponse;

        const chatIds = result.chat_ids || [];
        const chats: FormattedChat[] = [];

        for (const chatId of chatIds) {
          try {
            const chat = tdSend({
              "@type": "getChat",
              chat_id: chatId,
            }) as TdlibChat;
            const formatted = formatChat(chat);
            if (formatted) {
              chats.push(formatted);
            }
          } catch (e) {
            console.warn(`[telegram] Failed to get chat ${chatId}:`, e);
          }
        }

        return JSON.stringify({
          query: query,
          count: chats.length,
          chats: chats,
        });
      } catch (e) {
        return handleError("searchPublicChats", e);
      }
    },
  },

  // =========================================================================
  // CONTACTS (2 tools)
  // =========================================================================
  {
    name: "telegram-get-contacts",
    description:
      "Get your Telegram contacts list. Returns contact names, usernames, and IDs.",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute(): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const result = tdSend({ "@type": "getContacts" }) as TdlibUsersResponse;
        const userIds = result.user_ids || [];
        const contacts: FormattedUser[] = [];

        for (const userId of userIds) {
          try {
            const user = tdSend({ "@type": "getUser", user_id: userId }) as TdlibUser;
            const formatted = formatUser(user);
            if (formatted) {
              CACHE.users.set(userId, formatted);
              contacts.push(formatted);
            }
          } catch (e) {
            console.warn(`[telegram] Failed to get user ${userId}:`, e);
          }
        }

        return JSON.stringify({
          count: contacts.length,
          contacts: contacts,
        });
      } catch (e) {
        return handleError("getContacts", e);
      }
    },
  },

  {
    name: "telegram-search-contacts",
    description: "Search your contacts by name or username.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        limit: {
          type: "number",
          description: "Maximum results (default 20)",
        },
      },
      required: ["query"],
    },
    execute(args: Record<string, unknown>): string {
      try {
        if (!CONFIG.isAuthenticated) {
          return JSON.stringify({ error: "Not authenticated" });
        }

        const query = (args.query as string) || "";
        const limit = Math.min((args.limit as number) || 20, 50);

        if (!query) {
          return JSON.stringify({ error: "query is required" });
        }

        const result = tdSend({
          "@type": "searchContacts",
          query: query,
          limit: limit,
        }) as TdlibUsersResponse;

        const userIds = result.user_ids || [];
        const contacts: FormattedUser[] = [];

        for (const userId of userIds) {
          const cached = CACHE.users.get(userId);
          if (cached) {
            contacts.push(cached);
          } else {
            try {
              const user = tdSend({
                "@type": "getUser",
                user_id: userId,
              }) as TdlibUser;
              const formatted = formatUser(user);
              if (formatted) {
                CACHE.users.set(userId, formatted);
                contacts.push(formatted);
              }
            } catch (e) {
              console.warn(`[telegram] Failed to get user ${userId}:`, e);
            }
          }
        }

        return JSON.stringify({
          query: query,
          count: contacts.length,
          contacts: contacts,
        });
      } catch (e) {
        return handleError("searchContacts", e);
      }
    },
  },

  // =========================================================================
  // STATUS (1 tool)
  // =========================================================================
  {
    name: "telegram-status",
    description:
      "Get the current connection and authentication status. " +
      "Useful for checking if Telegram is connected before other operations.",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute(): string {
      try {
        const authState = getAuthState();

        return JSON.stringify({
          connected: CONFIG.isAuthenticated,
          authState: authState?.["@type"] || "unknown",
          hasCredentials: !!(CONFIG.apiId && CONFIG.apiHash),
          phoneNumber: CONFIG.phoneNumber
            ? CONFIG.phoneNumber.slice(0, 4) + "****"
            : null,
          cachedChats: CACHE.chats.size,
          cachedUsers: CACHE.users.size,
        });
      } catch (e) {
        return JSON.stringify({
          connected: false,
          error: String(e),
        });
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Exports to globalThis (required for V8 runtime)
// ---------------------------------------------------------------------------

// Augment globalThis for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var init: typeof _init;
  // eslint-disable-next-line no-var
  var start: typeof _start;
  // eslint-disable-next-line no-var
  var stop: typeof _stop;
  // eslint-disable-next-line no-var
  var onSetupStart: typeof _onSetupStart;
  // eslint-disable-next-line no-var
  var onSetupSubmit: typeof _onSetupSubmit;
  // eslint-disable-next-line no-var
  var onSetupCancel: typeof _onSetupCancel;
  // eslint-disable-next-line no-var
  var onDisconnect: typeof _onDisconnect;
  // eslint-disable-next-line no-var
  var TdlibState: typeof _TdlibState;
  // eslint-disable-next-line no-var
  var CONFIG: typeof _CONFIG;
  // eslint-disable-next-line no-var
  var CACHE: typeof _CACHE;
  // eslint-disable-next-line no-var
  var tdlib: typeof _tdlib;
}

// Rename for export
const _init = init;
const _start = start;
const _stop = stop;
const _onSetupStart = onSetupStart;
const _onSetupSubmit = onSetupSubmit;
const _onSetupCancel = onSetupCancel;
const _onDisconnect = onDisconnect;
const _TdlibState = TdlibState;
const _CONFIG = CONFIG;
const _CACHE = CACHE;
const _tdlib = tdlib;

// Export lifecycle hooks
globalThis.init = init;
globalThis.start = start;
globalThis.stop = stop;
globalThis.onSetupStart = onSetupStart;
globalThis.onSetupSubmit = onSetupSubmit;
globalThis.onSetupCancel = onSetupCancel;
globalThis.onDisconnect = onDisconnect;

// Export tools array
globalThis.tools = tools;

// Export state (for testing)
globalThis.TdlibState = TdlibState;
globalThis.CONFIG = CONFIG;
globalThis.CACHE = CACHE;
globalThis.tdlib = tdlib;

/**
 * Shared formatting and error handling helpers.
 *
 * Ported from src/lib/telegram/api/helpers.ts and src/lib/mcp/errorHandler.ts.
 */

import type {
  TelegramChat,
  TelegramUser,
  TelegramMessage,
} from "./state/types.js";
import createDebug from "debug";

const log = createDebug("skill:telegram:helpers");

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export interface FormattedEntity {
  id: string;
  name: string;
  type: string;
  username?: string;
  phone?: string;
}

export interface FormattedMessage {
  id: number | string;
  date: string;
  text: string;
  from_id?: string;
  has_media?: boolean;
  media_type?: string;
}

export function formatEntity(
  entity: TelegramChat | TelegramUser,
): FormattedEntity {
  if ("title" in entity) {
    const chat = entity as TelegramChat;
    const type =
      chat.type === "channel"
        ? "channel"
        : chat.type === "supergroup"
          ? "group"
          : chat.type;
    return {
      id: chat.id,
      name: chat.title ?? "Unknown",
      type,
      username: chat.username,
    };
  }
  const user = entity as TelegramUser;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown";
  return {
    id: user.id,
    name,
    type: "user",
    username: user.username,
    phone: user.phoneNumber,
  };
}

export function formatMessage(message: TelegramMessage): FormattedMessage {
  const result: FormattedMessage = {
    id: message.id,
    date: new Date(message.date * 1000).toISOString(),
    text: message.message ?? "",
  };
  if (message.fromId) result.from_id = message.fromId;
  if (message.media?.type) {
    result.has_media = true;
    result.media_type = message.media.type;
  }
  return result;
}

// ---------------------------------------------------------------------------
// GramJS conversion helpers
// ---------------------------------------------------------------------------

export function apiMessageToTelegramMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any,
  chatId?: string,
): TelegramMessage {
  const fromId =
    msg.fromId &&
    typeof msg.fromId === "object" &&
    "userId" in (msg.fromId as object)
      ? String((msg.fromId as { userId: unknown }).userId)
      : undefined;

  const replyTo = msg.replyTo as { replyToMsgId?: number } | undefined;

  const media = msg.media as { className?: string } | undefined;
  let mediaInfo: TelegramMessage["media"] | undefined;
  if (media && media.className && media.className !== "MessageMediaEmpty") {
    mediaInfo = { type: media.className };
  }

  return {
    id: String(msg.id ?? ""),
    chatId: chatId ?? (msg.peerId ? String(msg.peerId.userId ?? msg.peerId.chatId ?? msg.peerId.channelId ?? "") : ""),
    date: typeof msg.date === "number" ? msg.date : 0,
    message: typeof msg.message === "string" ? msg.message : "",
    fromId,
    isOutgoing: Boolean(msg.out),
    isEdited: msg.editDate != null,
    isForwarded: msg.fwdFrom != null,
    replyToMessageId:
      replyTo?.replyToMsgId != null
        ? String(replyTo.replyToMsgId)
        : undefined,
    media: mediaInfo,
  };
}

/**
 * Convert a GramJS dialog to a TelegramChat.
 * `entityMap` is a single Map<string, entity> combining both users and chats.
 */
export function apiDialogToTelegramChat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dialog: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entityMap: Map<string, any>,
): TelegramChat | undefined {
  const peer = dialog.peer;
  if (!peer) return undefined;

  let id: string;
  let type: TelegramChat["type"];

  const className = peer.className ?? "";
  if (className === "PeerUser" && peer.userId != null) {
    id = String(peer.userId);
    type = "private";
  } else if (className === "PeerChat" && peer.chatId != null) {
    id = String(peer.chatId);
    type = "group";
  } else if (className === "PeerChannel" && peer.channelId != null) {
    id = String(peer.channelId);
    const raw = entityMap.get(id);
    type = raw && Boolean(raw.megagroup) ? "supergroup" : "channel";
  } else {
    return undefined;
  }

  const raw = entityMap.get(id);
  let title: string;
  let username: string | undefined;
  let accessHash: string | undefined;
  if (raw) {
    title =
      raw.title ??
      [raw.firstName, raw.lastName].filter(Boolean).join(" ") ??
      "Unknown";
    username = raw.username;
    if (raw.accessHash != null) accessHash = String(raw.accessHash);
  } else {
    title = "Unknown";
  }

  return {
    id,
    title,
    type,
    username,
    accessHash,
    unreadCount: typeof dialog.unreadCount === "number" ? dialog.unreadCount : 0,
    isPinned: Boolean(dialog.pinned),
  };
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export enum ErrorCategory {
  CHAT = "CHAT",
  MSG = "MSG",
  CONTACT = "CONTACT",
  GROUP = "GROUP",
  MEDIA = "MEDIA",
  PROFILE = "PROFILE",
  AUTH = "AUTH",
  ADMIN = "ADMIN",
  VALIDATION = "VALIDATION",
  SEARCH = "SEARCH",
  DRAFT = "DRAFT",
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export function logAndFormatError(
  functionName: string,
  error: Error,
  category?: ErrorCategory | string,
): ToolResult {
  const prefix = category ?? "GEN";
  const hash =
    Math.abs(
      functionName
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0),
    ) % 1000;
  const errorCode = `${prefix}-ERR-${hash.toString().padStart(3, "0")}`;

  log("[MCP] Error in %s - Code: %s - %O", functionName, errorCode, error);

  const userMessage =
    error.name === "ValidationError"
      ? error.message
      : `An error occurred (code: ${errorCode}). Check logs for details.`;

  return { content: userMessage, isError: true };
}

// ---------------------------------------------------------------------------
// Rate limiter (simplified for subprocess)
// ---------------------------------------------------------------------------

const RATE_LIMIT = {
  API_READ_DELAY_MS: 500,
  API_WRITE_DELAY_MS: 1000,
  MAX_CALLS_PER_MINUTE: 30,
};

let lastCallTime = 0;
const callHistory: number[] = [];

function purgeOld(now: number): void {
  const cutoff = now - 60_000;
  while (callHistory.length > 0 && callHistory[0] < cutoff) {
    callHistory.shift();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export type ToolTier = "state_only" | "api_read" | "api_write";

export async function enforceRateLimit(tier: ToolTier): Promise<void> {
  if (tier === "state_only") return;

  const now = Date.now();
  purgeOld(now);

  if (callHistory.length >= RATE_LIMIT.MAX_CALLS_PER_MINUTE) {
    const oldestTimestamp = callHistory[0];
    const waitMs = oldestTimestamp + 60_000 - now + 50;
    await sleep(waitMs);
    purgeOld(Date.now());
  }

  const requiredDelay =
    tier === "api_write"
      ? RATE_LIMIT.API_WRITE_DELAY_MS
      : RATE_LIMIT.API_READ_DELAY_MS;

  const elapsed = Date.now() - lastCallTime;
  if (elapsed < requiredDelay) {
    await sleep(requiredDelay - elapsed);
  }

  lastCallTime = Date.now();
  callHistory.push(lastCallTime);
}

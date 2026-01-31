/**
 * Admin domain tool handlers.
 */

import * as adminApi from "../api/admin-api.js";
import { logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, optNumber, optString } from "../validation.js";

export async function get_participants(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 100);
    const filter = optString(args, "filter") ?? "recent";

    const { data: participants } = await adminApi.getParticipants(String(chatId), limit, filter);
    if (participants.length === 0) {
      return { content: `No participants found in chat ${chatId}.` };
    }

    const lines = participants.map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown";
      return `${name} (ID: ${p.id})${p.username ? ` @${p.username}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_participants", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function get_admins(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data: admins } = await adminApi.getAdmins(String(chatId));

    if (admins.length === 0) {
      return { content: `No admins found in chat ${chatId}.` };
    }

    const lines = admins.map((a) => {
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || "Unknown";
      return `${name} (ID: ${a.id})${a.username ? ` @${a.username}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_admins", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function get_banned_users(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 100);

    const { data: banned } = await adminApi.getBannedUsers(String(chatId), limit);
    if (banned.length === 0) {
      return { content: `No banned users in chat ${chatId}.` };
    }

    const lines = banned.map((u) => `${u.firstName} (ID: ${u.id})`);
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_banned_users", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function promote_admin(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const userId = validateId(args.user_id, "user_id");
    const title = optString(args, "title");

    await adminApi.promoteAdmin(String(chatId), String(userId), title);
    return { content: `User ${userId} promoted to admin in chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("promote_admin", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function demote_admin(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const userId = validateId(args.user_id, "user_id");

    await adminApi.demoteAdmin(String(chatId), String(userId));
    return { content: `User ${userId} demoted from admin in chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("demote_admin", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function ban_user(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const userId = validateId(args.user_id, "user_id");
    const untilDate = typeof args.until_date === "number" ? args.until_date : undefined;

    await adminApi.banUser(String(chatId), String(userId), untilDate);
    return { content: `User ${userId} banned from chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("ban_user", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function unban_user(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const userId = validateId(args.user_id, "user_id");

    await adminApi.unbanUser(String(chatId), String(userId));
    return { content: `User ${userId} unbanned in chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("unban_user", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

export async function get_recent_actions(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 20);

    const { data: actions } = await adminApi.getRecentActions(String(chatId), limit);
    if (actions.length === 0) {
      return { content: `No recent admin actions in chat ${chatId}.` };
    }
    return { content: actions.join("\n") };
  } catch (error) {
    return logAndFormatError("get_recent_actions", error instanceof Error ? error : new Error(String(error)), ErrorCategory.ADMIN);
  }
}

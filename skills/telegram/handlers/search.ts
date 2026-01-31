/**
 * Search domain tool handlers.
 */

import * as searchApi from "../api/search-api.js";
import { formatEntity, logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { optNumber, optString } from "../validation.js";

export async function search_public_chats(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const query = typeof args.query === "string" ? args.query : "";
    if (!query) return { content: "Search query is required", isError: true };
    const limit = optNumber(args, "limit", 20);

    const { data: chats } = await searchApi.searchPublicChats(query, limit);
    if (chats.length === 0) {
      return { content: `No public chats found for "${query}".` };
    }

    const lines = chats.map((c) => {
      const entity = formatEntity(c);
      return `[${entity.type}] ${entity.name} (ID: ${entity.id})${entity.username ? ` @${entity.username}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("search_public_chats", error instanceof Error ? error : new Error(String(error)), ErrorCategory.SEARCH);
  }
}

export async function search_messages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const query = typeof args.query === "string" ? args.query : "";
    if (!query) return { content: "Search query is required", isError: true };
    const chatId = optString(args, "chat_id");
    const limit = optNumber(args, "limit", 20);

    const { data: messages } = await searchApi.searchMessages(query, chatId, limit);
    if (messages.length === 0) {
      return { content: `No messages found for "${query}".` };
    }

    const lines = messages.map((m) => {
      const date = new Date(m.date * 1000).toISOString();
      return `[${m.chatId}/${m.id}] ${date}: ${m.message}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("search_messages", error instanceof Error ? error : new Error(String(error)), ErrorCategory.SEARCH);
  }
}

export async function resolve_username(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const username = typeof args.username === "string" ? args.username : "";
    if (!username) return { content: "Username is required", isError: true };

    const { data } = await searchApi.resolveUsername(username);
    if (!data) {
      return { content: `Username @${username.replace("@", "")} not found.` };
    }
    return { content: data };
  } catch (error) {
    return logAndFormatError("resolve_username", error instanceof Error ? error : new Error(String(error)), ErrorCategory.SEARCH);
  }
}

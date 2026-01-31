/**
 * Chat domain tool handlers.
 *
 * Each handler takes args + returns { content, isError? }.
 */

import * as chatApi from "../api/chat-api.js";
import { formatEntity, logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, optNumber } from "../validation.js";

export async function get_chats(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const page = optNumber(args, "page", 1);
    const pageSize = optNumber(args, "page_size", 20);
    const start = (page - 1) * pageSize;

    const { data: allChats } = await chatApi.getChats(pageSize + start);
    const paginatedChats = allChats.slice(start, start + pageSize);

    if (paginatedChats.length === 0) {
      return { content: "Page out of range." };
    }

    const lines = paginatedChats.map((chat) => {
      const entity = formatEntity(chat);
      return `Chat ID: ${entity.id}, Title: ${entity.name}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_chats", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function list_chats(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatType = typeof args.chat_type === "string" ? args.chat_type : undefined;
    const limit = optNumber(args, "limit", 20);

    const { data: chats } = await chatApi.getChats(limit);
    const filtered = chatType ? chats.filter((c) => c.type === chatType) : chats;

    if (filtered.length === 0) {
      return { content: chatType ? `No ${chatType} chats found.` : "No chats found." };
    }

    const lines = filtered.map((chat) => {
      const entity = formatEntity(chat);
      return `[${entity.type}] ${entity.name} (ID: ${entity.id})${entity.username ? ` @${entity.username}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("list_chats", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function get_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data: chat } = await chatApi.getChat(String(chatId));
    if (!chat) {
      return { content: `Chat ${chatId} not found.`, isError: true };
    }
    const entity = formatEntity(chat);
    const lines = [
      `Chat ID: ${entity.id}`,
      `Name: ${entity.name}`,
      `Type: ${entity.type}`,
    ];
    if (entity.username) lines.push(`Username: @${entity.username}`);
    if (chat.participantsCount) lines.push(`Participants: ${chat.participantsCount}`);
    lines.push(`Unread: ${chat.unreadCount}`);
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function create_group(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const title = typeof args.title === "string" ? args.title : "";
    const userIds = Array.isArray(args.user_ids) ? args.user_ids.map(String) : [];
    if (!title) return { content: "Title is required", isError: true };
    if (userIds.length === 0) return { content: "At least one user ID is required", isError: true };

    const { data } = await chatApi.createGroup(title, userIds);
    return { content: data ? `Group "${title}" created successfully.` : `Failed to create group "${title}".` };
  } catch (error) {
    return logAndFormatError("create_group", error instanceof Error ? error : new Error(String(error)), ErrorCategory.GROUP);
  }
}

export async function invite_to_group(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const userIds = Array.isArray(args.user_ids) ? args.user_ids.map(String) : [];
    if (userIds.length === 0) return { content: "At least one user ID is required", isError: true };

    await chatApi.inviteToGroup(String(chatId), userIds);
    return { content: `Invited ${userIds.length} user(s) to chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("invite_to_group", error instanceof Error ? error : new Error(String(error)), ErrorCategory.GROUP);
  }
}

export async function create_channel(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const title = typeof args.title === "string" ? args.title : "";
    const description = typeof args.description === "string" ? args.description : undefined;
    const megagroup = typeof args.megagroup === "boolean" ? args.megagroup : false;
    if (!title) return { content: "Title is required", isError: true };

    const { data } = await chatApi.createChannel(title, description, megagroup);
    return { content: data ? `Channel "${title}" created successfully.` : `Failed to create channel "${title}".` };
  } catch (error) {
    return logAndFormatError("create_channel", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function edit_chat_title(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const newTitle = typeof args.new_title === "string" ? args.new_title : "";
    if (!newTitle) return { content: "New title is required", isError: true };

    await chatApi.editChatTitle(String(chatId), newTitle);
    return { content: `Chat title updated to "${newTitle}".` };
  } catch (error) {
    return logAndFormatError("edit_chat_title", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function delete_chat_photo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await chatApi.deleteChatPhoto(String(chatId));
    return { content: "Chat photo deleted." };
  } catch (error) {
    return logAndFormatError("delete_chat_photo", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function leave_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await chatApi.leaveChat(String(chatId));
    return { content: `Left chat ${chatId}.` };
  } catch (error) {
    return logAndFormatError("leave_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function get_invite_link(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data } = await chatApi.getInviteLink(String(chatId));
    return { content: data ? `Invite link: ${data}` : "Failed to get invite link." };
  } catch (error) {
    return logAndFormatError("get_invite_link", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function export_chat_invite(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const expireDate = typeof args.expire_date === "number" ? args.expire_date : undefined;
    const usageLimit = typeof args.usage_limit === "number" ? args.usage_limit : undefined;

    const { data } = await chatApi.exportChatInvite(String(chatId), expireDate, usageLimit);
    return { content: data ? `Invite link: ${data}` : "Failed to export invite link." };
  } catch (error) {
    return logAndFormatError("export_chat_invite", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function import_chat_invite(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const inviteHash = typeof args.invite_hash === "string" ? args.invite_hash : "";
    if (!inviteHash) return { content: "Invite hash is required", isError: true };

    await chatApi.importChatInvite(inviteHash);
    return { content: "Successfully joined chat via invite." };
  } catch (error) {
    return logAndFormatError("import_chat_invite", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function join_chat_by_link(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const inviteLink = typeof args.invite_link === "string" ? args.invite_link : "";
    if (!inviteLink) return { content: "Invite link is required", isError: true };

    await chatApi.joinChatByLink(inviteLink);
    return { content: "Successfully joined chat via link." };
  } catch (error) {
    return logAndFormatError("join_chat_by_link", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function subscribe_public_channel(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const username = typeof args.username === "string" ? args.username : "";
    if (!username) return { content: "Username is required", isError: true };

    await chatApi.subscribePublicChannel(username);
    return { content: `Subscribed to @${username.replace("@", "")}.` };
  } catch (error) {
    return logAndFormatError("subscribe_public_channel", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

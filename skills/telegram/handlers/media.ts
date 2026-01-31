/**
 * Media, profile, and bot tool handlers.
 */

import * as settingsApi from "../api/settings-api.js";
import { formatEntity, logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, optNumber, optString } from "../validation.js";

export async function get_me(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { data: user } = await settingsApi.getMe();
    if (!user) {
      return { content: "Unable to retrieve current user info.", isError: true };
    }
    const entity = formatEntity(user);
    const lines = [
      `Name: ${entity.name}`,
      `ID: ${entity.id}`,
      `Type: ${entity.type}`,
    ];
    if (entity.username) lines.push(`Username: @${entity.username}`);
    if (entity.phone) lines.push(`Phone: ${entity.phone}`);
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_me", error instanceof Error ? error : new Error(String(error)), ErrorCategory.PROFILE);
  }
}

export async function update_profile(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const firstName = optString(args, "first_name");
    const lastName = optString(args, "last_name");
    const bio = optString(args, "bio");

    await settingsApi.updateProfile(firstName, lastName, bio);
    return { content: "Profile updated successfully." };
  } catch (error) {
    return logAndFormatError("update_profile", error instanceof Error ? error : new Error(String(error)), ErrorCategory.PROFILE);
  }
}

export async function get_user_photos(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    const limit = optNumber(args, "limit", 20);

    const { data } = await settingsApi.getUserPhotos(String(userId), limit);
    if (!data || data.length === 0) {
      return { content: `No photos found for user ${userId}.` };
    }
    return { content: data.join("\n") };
  } catch (error) {
    return logAndFormatError("get_user_photos", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function get_user_status(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    const { data } = await settingsApi.getUserStatus(String(userId));
    return { content: data || `Status for user ${userId}: unknown` };
  } catch (error) {
    return logAndFormatError("get_user_status", error instanceof Error ? error : new Error(String(error)), ErrorCategory.PROFILE);
  }
}

export async function set_profile_photo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const filePath = optString(args, "file_path");
    const url = optString(args, "url");

    await settingsApi.setProfilePhoto(filePath, url);
    return { content: "Profile photo updated." };
  } catch (error) {
    return logAndFormatError("set_profile_photo", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function delete_profile_photo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const photoId = optString(args, "photo_id");
    await settingsApi.deleteProfilePhoto(photoId);
    return { content: "Profile photo deleted." };
  } catch (error) {
    return logAndFormatError("delete_profile_photo", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function edit_chat_photo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const filePath = optString(args, "file_path");

    await settingsApi.editChatPhoto(String(chatId), filePath);
    return { content: "Chat photo updated." };
  } catch (error) {
    return logAndFormatError("edit_chat_photo", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function get_media_info(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = typeof args.message_id === "number" ? args.message_id : 0;

    // Read from cached messages in store
    const store = await import("../state/store.js");
    const state = store.getState();
    const msg = state.messages[String(chatId)]?.[String(messageId)];
    if (!msg) {
      return { content: `Message ${messageId} not found in chat ${chatId}.` };
    }
    if (!msg.media) {
      return { content: `Message ${messageId} has no media.` };
    }
    return { content: `Media type: ${msg.media.type}` };
  } catch (error) {
    return logAndFormatError("get_media_info", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function get_bot_info(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data } = await settingsApi.getBotInfo(String(chatId));
    return { content: data || `Bot info for ${chatId}: not available` };
  } catch (error) {
    return logAndFormatError("get_bot_info", error instanceof Error ? error : new Error(String(error)), ErrorCategory.PROFILE);
  }
}

export async function set_bot_commands(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const commands = Array.isArray(args.commands) ? args.commands : [];
    const chatId = optString(args, "chat_id");

    await settingsApi.setBotCommands(
      commands.map((c: Record<string, unknown>) => ({
        command: String(c.command ?? ""),
        description: String(c.description ?? ""),
      })),
      chatId,
    );
    return { content: `${commands.length} bot commands set.` };
  } catch (error) {
    return logAndFormatError("set_bot_commands", error instanceof Error ? error : new Error(String(error)), ErrorCategory.PROFILE);
  }
}

export async function get_sticker_sets(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const limit = optNumber(args, "limit", 20);
    const { data } = await settingsApi.getStickerSets(limit);
    if (!data || data.length === 0) {
      return { content: "No sticker sets found." };
    }
    return { content: data.join("\n") };
  } catch (error) {
    return logAndFormatError("get_sticker_sets", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

export async function get_gif_search(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const query = typeof args.query === "string" ? args.query : "";
    if (!query) return { content: "Search query is required", isError: true };
    const limit = optNumber(args, "limit", 20);

    const { data } = await settingsApi.getGifSearch(query, limit);
    if (!data || data.length === 0) {
      return { content: `No GIFs found for "${query}".` };
    }
    return { content: data.join("\n") };
  } catch (error) {
    return logAndFormatError("get_gif_search", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MEDIA);
  }
}

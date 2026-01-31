/**
 * Settings domain tool handlers (mute, archive, privacy).
 */

import * as settingsApi from "../api/settings-api.js";
import { logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, optNumber, optString } from "../validation.js";

export async function mute_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const muteFor = typeof args.mute_for === "number" ? args.mute_for : undefined;

    await settingsApi.muteChat(String(chatId), muteFor);
    return { content: `Chat ${chatId} muted.` };
  } catch (error) {
    return logAndFormatError("mute_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function unmute_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await settingsApi.unmuteChat(String(chatId));
    return { content: `Chat ${chatId} unmuted.` };
  } catch (error) {
    return logAndFormatError("unmute_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function archive_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await settingsApi.archiveChat(String(chatId));
    return { content: `Chat ${chatId} archived.` };
  } catch (error) {
    return logAndFormatError("archive_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function unarchive_chat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await settingsApi.unarchiveChat(String(chatId));
    return { content: `Chat ${chatId} unarchived.` };
  } catch (error) {
    return logAndFormatError("unarchive_chat", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function get_privacy_settings(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { data } = await settingsApi.getPrivacySettings();
    if (!data) {
      return { content: "Unable to retrieve privacy settings." };
    }
    return { content: data };
  } catch (error) {
    return logAndFormatError("get_privacy_settings", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

export async function set_privacy_settings(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const setting = typeof args.setting === "string" ? args.setting : "";
    const value = typeof args.value === "string" ? args.value : "";
    if (!setting) return { content: "Setting name is required", isError: true };
    if (!value) return { content: "Setting value is required", isError: true };

    await settingsApi.setPrivacySettings(setting, value);
    return { content: `Privacy setting "${setting}" updated to "${value}".` };
  } catch (error) {
    return logAndFormatError("set_privacy_settings", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CHAT);
  }
}

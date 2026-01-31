/**
 * Message domain tool handlers.
 */

import * as messageApi from "../api/message-api.js";
import { formatMessage, logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, validatePositiveInt, optNumber, optString, optBoolean } from "../validation.js";

export async function get_messages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 20);
    const offset = optNumber(args, "offset", 0);

    const { data: messages } = await messageApi.getMessages(String(chatId), limit, offset);
    if (!messages || messages.length === 0) {
      return { content: `No messages found in chat ${chatId}.` };
    }

    const lines = messages.map((m) => {
      const f = formatMessage(m);
      const from = f.from_id ? ` [from: ${f.from_id}]` : "";
      const media = f.has_media ? ` [${f.media_type}]` : "";
      return `${f.date}${from}: ${f.text}${media}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_messages", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function list_messages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 20);

    const { data: messages } = await messageApi.getMessages(String(chatId), limit);
    if (!messages || messages.length === 0) {
      return { content: `No messages in chat ${chatId}.` };
    }

    const lines = messages.map((m) => {
      const f = formatMessage(m);
      return `[${f.id}] ${f.date} ${f.from_id ? `<${f.from_id}>` : ""} ${f.text}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("list_messages", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function list_topics(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data: topics } = await messageApi.listTopics(String(chatId));

    if (!topics || topics.length === 0) {
      return { content: `No topics found in chat ${chatId}.` };
    }
    return { content: topics.join("\n") };
  } catch (error) {
    return logAndFormatError("list_topics", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function send_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const message = typeof args.message === "string" ? args.message : "";
    if (!message) return { content: "Message content is required", isError: true };

    const { data } = await messageApi.sendMessage(String(chatId), message);
    if (!data) return { content: `Failed to send message to chat ${chatId}`, isError: true };
    return { content: "Message sent successfully." };
  } catch (error) {
    return logAndFormatError("send_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function reply_to_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const text = typeof args.text === "string" ? args.text : "";
    if (!text) return { content: "Reply text is required", isError: true };

    await messageApi.replyToMessage(String(chatId), messageId, text);
    return { content: "Reply sent successfully." };
  } catch (error) {
    return logAndFormatError("reply_to_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function edit_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const newText = typeof args.new_text === "string" ? args.new_text : "";
    if (!newText) return { content: "New text is required", isError: true };

    await messageApi.editMessage(String(chatId), messageId, newText);
    return { content: "Message edited successfully." };
  } catch (error) {
    return logAndFormatError("edit_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function delete_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const revoke = optBoolean(args, "revoke", true);

    await messageApi.deleteMessage(String(chatId), messageId, revoke);
    return { content: "Message deleted successfully." };
  } catch (error) {
    return logAndFormatError("delete_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function forward_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const fromChatId = validateId(args.from_chat_id, "from_chat_id");
    const toChatId = validateId(args.to_chat_id, "to_chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");

    await messageApi.forwardMessage(String(fromChatId), String(toChatId), messageId);
    return { content: "Message forwarded successfully." };
  } catch (error) {
    return logAndFormatError("forward_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function pin_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const notify = optBoolean(args, "notify", true);

    await messageApi.pinMessage(String(chatId), messageId, notify);
    return { content: "Message pinned successfully." };
  } catch (error) {
    return logAndFormatError("pin_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function unpin_message(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");

    await messageApi.unpinMessage(String(chatId), messageId);
    return { content: "Message unpinned successfully." };
  } catch (error) {
    return logAndFormatError("unpin_message", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function mark_as_read(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await messageApi.markAsRead(String(chatId));
    return { content: "Messages marked as read." };
  } catch (error) {
    return logAndFormatError("mark_as_read", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function get_message_context(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const limit = optNumber(args, "limit", 5);

    // Get messages around the target, using history with offset
    const { data: messages } = await messageApi.getHistory(String(chatId), limit * 2 + 1, messageId);
    if (!messages || messages.length === 0) {
      return { content: `No context found for message ${messageId}.` };
    }

    const lines = messages.map((m) => {
      const f = formatMessage(m);
      const marker = String(m.id) === String(messageId) ? " >>> " : "     ";
      return `${marker}[${f.id}] ${f.date}: ${f.text}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_message_context", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function get_history(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const limit = optNumber(args, "limit", 20);
    const offsetId = typeof args.offset_id === "number" ? args.offset_id : undefined;

    const { data: messages } = await messageApi.getHistory(String(chatId), limit, offsetId);
    if (!messages || messages.length === 0) {
      return { content: `No message history in chat ${chatId}.` };
    }

    const lines = messages.map((m) => {
      const f = formatMessage(m);
      return `[${f.id}] ${f.date}: ${f.text}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_history", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function get_pinned_messages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const { data: messages } = await messageApi.getPinnedMessages(String(chatId));

    if (!messages || messages.length === 0) {
      return { content: `No pinned messages in chat ${chatId}.` };
    }

    const lines = messages.map((m) => {
      const f = formatMessage(m);
      return `[${f.id}] ${f.date}: ${f.text}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_pinned_messages", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function send_reaction(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const reaction = typeof args.reaction === "string" ? args.reaction : "👍";

    await messageApi.sendReaction(String(chatId), messageId, reaction);
    return { content: `Reaction ${reaction} added.` };
  } catch (error) {
    return logAndFormatError("send_reaction", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function remove_reaction(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");
    const reaction = optString(args, "reaction");

    await messageApi.removeReaction(String(chatId), messageId, reaction);
    return { content: "Reaction removed." };
  } catch (error) {
    return logAndFormatError("remove_reaction", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function get_message_reactions(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");

    const { data } = await messageApi.getMessageReactions(String(chatId), messageId);
    if (!data || data.length === 0) {
      return { content: "No reactions on this message." };
    }
    return { content: data.join("\n") };
  } catch (error) {
    return logAndFormatError("get_message_reactions", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function list_inline_buttons(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");

    // Read from cached messages in store
    const { data } = await messageApi.getMessages(String(chatId), 1);
    // This is a simplified implementation — inline buttons are on the raw message
    return { content: `Inline buttons for message ${messageId} in chat ${chatId}: check message media/replyMarkup.` };
  } catch (error) {
    return logAndFormatError("list_inline_buttons", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function press_inline_button(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const messageId = validatePositiveInt(args.message_id, "message_id");

    return { content: `Inline button press for message ${messageId} in chat ${chatId} — requires raw message data.` };
  } catch (error) {
    return logAndFormatError("press_inline_button", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

export async function save_draft(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const text = typeof args.text === "string" ? args.text : "";
    if (!text) return { content: "Draft text is required", isError: true };
    const replyToMsgId = typeof args.reply_to_message_id === "number" ? args.reply_to_message_id : undefined;

    await messageApi.saveDraft(String(chatId), text, replyToMsgId);
    return { content: "Draft saved." };
  } catch (error) {
    return logAndFormatError("save_draft", error instanceof Error ? error : new Error(String(error)), ErrorCategory.DRAFT);
  }
}

export async function get_drafts(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { data } = await messageApi.getDrafts();
    if (!data || data.length === 0) {
      return { content: "No drafts found." };
    }
    return { content: data.join("\n") };
  } catch (error) {
    return logAndFormatError("get_drafts", error instanceof Error ? error : new Error(String(error)), ErrorCategory.DRAFT);
  }
}

export async function clear_draft(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    await messageApi.clearDraft(String(chatId));
    return { content: "Draft cleared." };
  } catch (error) {
    return logAndFormatError("clear_draft", error instanceof Error ? error : new Error(String(error)), ErrorCategory.DRAFT);
  }
}

export async function create_poll(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const chatId = validateId(args.chat_id, "chat_id");
    const question = typeof args.question === "string" ? args.question : "";
    const options = Array.isArray(args.options) ? args.options.map(String) : [];
    if (!question) return { content: "Question is required", isError: true };
    if (options.length < 2) return { content: "At least 2 options are required", isError: true };

    const anonymous = optBoolean(args, "anonymous", true);
    const multipleChoice = optBoolean(args, "multiple_choice", false);

    await messageApi.createPoll(String(chatId), question, options, anonymous, multipleChoice);
    return { content: "Poll created successfully." };
  } catch (error) {
    return logAndFormatError("create_poll", error instanceof Error ? error : new Error(String(error)), ErrorCategory.MSG);
  }
}

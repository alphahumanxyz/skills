import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildMessage, buildEntityMap, toInputPeer } from "../mtproto/builders.js";
import * as store from "../state/store.js";
import { apiMessageToTelegramMessage, enforceRateLimit } from "../helpers.js";
import type { TelegramMessage } from "../state/types.js";
import createDebug from "debug";

const log = createDebug("skill:telegram:api:message");

interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

/**
 * Get messages from a chat (cache-first)
 */
export async function getMessages(
  chatId: string | number,
  limit = 20,
  offset = 0
): Promise<ApiResult<TelegramMessage[]>> {
  try {
    // Try cache first
    const cached = store.getCachedMessages(String(chatId), limit, offset);
    if (cached && cached.length > 0) {
      log(`Returning ${cached.length} cached messages for chat ${chatId}`);
      return { data: cached, fromCache: true };
    }

    // Rate limit before API call
    await enforceRateLimit("api_read");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.GetHistory({
          peer: entity,
          limit,
          offsetId: offset,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: bigInt.zero,
        })
      );
    });

    if (!result || !("messages" in result)) {
      return { data: [], fromCache: false };
    }

    const messages: TelegramMessage[] = result.messages
      .filter((msg): msg is Api.Message => msg instanceof Api.Message)
      .map((msg) => apiMessageToTelegramMessage(msg));

    // Update store
    store.addMessages(String(chatId), messages);

    log(`Fetched ${messages.length} messages from chat ${chatId}`);
    return { data: messages, fromCache: false };
  } catch (error) {
    log(`Error fetching messages for chat ${chatId}:`, error);
    return { data: [], fromCache: false };
  }
}

/**
 * Send a message to a chat
 */
export async function sendMessage(
  chatId: string | number,
  message: string,
  replyToMessageId?: number
): Promise<{ id: number }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const chat = store.getChatById(String(chatId));

    // Determine entity (username or id)
    const entity = chat?.username || chatId;

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().sendMessage(entity, {
        message,
        replyTo: replyToMessageId,
      });
    });

    log(`Sent message to chat ${chatId}, message ID: ${result.id}`);
    return { id: result.id };
  } catch (error) {
    log(`Error sending message to chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Reply to a specific message
 */
export async function replyToMessage(
  chatId: string | number,
  messageId: number,
  text: string
): Promise<{ id: number }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const chat = store.getChatById(String(chatId));
    const entity = chat?.username || chatId;

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().sendMessage(entity, {
        message: text,
        replyTo: messageId,
      });
    });

    log(`Replied to message ${messageId} in chat ${chatId}, new message ID: ${result.id}`);
    return { id: result.id };
  } catch (error) {
    log(`Error replying to message ${messageId} in chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * Edit an existing message
 */
export async function editMessage(
  chatId: string | number,
  messageId: number,
  newText: string
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.EditMessage({
          peer: entity,
          id: messageId,
          message: newText,
        })
      );
    });

    log(`Edited message ${messageId} in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error editing message ${messageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(
  chatId: string | number,
  messageId: number,
  revoke = true
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.DeleteMessages({
          id: [messageId],
          revoke,
        })
      );
    });

    // Remove from store
    store.removeMessage(String(chatId), messageId);

    log(`Deleted message ${messageId} from chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error deleting message ${messageId} from chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Forward a message from one chat to another
 */
export async function forwardMessage(
  fromChatId: string,
  toChatId: string,
  messageId: number
): Promise<{ id: number }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const fromEntity = await client.getClient().getInputEntity(fromChatId);
    const toEntity = await client.getClient().getInputEntity(toChatId);

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.ForwardMessages({
          fromPeer: fromEntity,
          toPeer: toEntity,
          id: [messageId],
          randomId: [bigInt(Math.floor(Math.random() * 1e16))],
        })
      );
    });

    const updates = result as Api.Updates;
    const newMessageId = updates.updates.find(
      (u): u is Api.UpdateMessageID => u instanceof Api.UpdateMessageID
    )?.id || 0;

    log(`Forwarded message ${messageId} from ${fromChatId} to ${toChatId}, new ID: ${newMessageId}`);
    return { id: newMessageId };
  } catch (error) {
    log(`Error forwarding message ${messageId} from ${fromChatId} to ${toChatId}:`, error);
    throw error;
  }
}

/**
 * Pin a message in a chat
 */
export async function pinMessage(
  chatId: string,
  messageId: number,
  notify = true
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.UpdatePinnedMessage({
          peer: entity,
          id: messageId,
          silent: !notify,
        })
      );
    });

    log(`Pinned message ${messageId} in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error pinning message ${messageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Unpin a message in a chat
 */
export async function unpinMessage(
  chatId: string,
  messageId: number
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.UpdatePinnedMessage({
          peer: entity,
          id: messageId,
          unpin: true,
        })
      );
    });

    log(`Unpinned message ${messageId} in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error unpinning message ${messageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Mark messages as read in a chat
 */
export async function markAsRead(chatId: string): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);
    const chat = store.getChatById(chatId);

    // Determine if it's a channel or regular chat
    const isChannel = chat?.type === "channel" || chat?.type === "supergroup";

    await client.withFloodWaitHandling(async () => {
      if (isChannel && "channelId" in entity) {
        return await client.getClient().invoke(
          new Api.channels.ReadHistory({
            channel: entity as Api.InputChannel,
            maxId: 0,
          })
        );
      } else {
        return await client.getClient().invoke(
          new Api.messages.ReadHistory({
            peer: entity,
            maxId: 0,
          })
        );
      }
    });

    log(`Marked messages as read in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error marking messages as read in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Get pinned messages from a chat
 */
export async function getPinnedMessages(chatId: string): Promise<ApiResult<TelegramMessage[]>> {
  try {
    await enforceRateLimit("api_read");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.Search({
          peer: entity,
          q: "",
          filter: new Api.InputMessagesFilterPinned(),
          minDate: 0,
          maxDate: 0,
          offsetId: 0,
          addOffset: 0,
          limit: 100,
          maxId: 0,
          minId: 0,
          hash: bigInt.zero,
        })
      );
    });

    if (!result || !("messages" in result)) {
      return { data: [], fromCache: false };
    }

    const messages: TelegramMessage[] = result.messages
      .filter((msg): msg is Api.Message => msg instanceof Api.Message)
      .map((msg) => apiMessageToTelegramMessage(msg));

    log(`Fetched ${messages.length} pinned messages from chat ${chatId}`);
    return { data: messages, fromCache: false };
  } catch (error) {
    log(`Error fetching pinned messages from chat ${chatId}:`, error);
    return { data: [], fromCache: false };
  }
}

/**
 * Send a reaction to a message
 */
export async function sendReaction(
  chatId: string,
  messageId: number,
  reaction: string
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.SendReaction({
          peer: entity,
          msgId: messageId,
          reaction: [new Api.ReactionEmoji({ emoticon: reaction })],
        })
      );
    });

    log(`Sent reaction "${reaction}" to message ${messageId} in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error sending reaction to message ${messageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(
  chatId: string,
  messageId: number,
  reaction?: string
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.SendReaction({
          peer: entity,
          msgId: messageId,
          reaction: [], // Empty array removes all reactions
        })
      );
    });

    log(`Removed reaction from message ${messageId} in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error removing reaction from message ${messageId} in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Get reactions for a message
 */
export async function getMessageReactions(
  chatId: string,
  messageId: number
): Promise<ApiResult<any[]>> {
  try {
    await enforceRateLimit("api_read");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.GetMessagesReactions({
          peer: entity,
          id: [messageId],
        })
      );
    });

    log(`Fetched reactions for message ${messageId} in chat ${chatId}`);
    return { data: result?.updates || [], fromCache: false };
  } catch (error) {
    log(`Error fetching reactions for message ${messageId} in chat ${chatId}:`, error);
    return { data: [], fromCache: false };
  }
}

/**
 * Get message history with offset
 */
export async function getHistory(
  chatId: string,
  limit = 20,
  offsetId?: number
): Promise<ApiResult<TelegramMessage[]>> {
  try {
    await enforceRateLimit("api_read");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.GetHistory({
          peer: entity,
          limit,
          offsetId: offsetId || 0,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: bigInt.zero,
        })
      );
    });

    if (!result || !("messages" in result)) {
      return { data: [], fromCache: false };
    }

    const messages: TelegramMessage[] = result.messages
      .filter((msg): msg is Api.Message => msg instanceof Api.Message)
      .map((msg) => apiMessageToTelegramMessage(msg));

    // Update store
    store.addMessages(String(chatId), messages);

    log(`Fetched ${messages.length} history messages from chat ${chatId}`);
    return { data: messages, fromCache: false };
  } catch (error) {
    log(`Error fetching history for chat ${chatId}:`, error);
    return { data: [], fromCache: false };
  }
}

/**
 * Save a draft message
 */
export async function saveDraft(
  chatId: string,
  text: string,
  replyToMsgId?: number
): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.SaveDraft({
          peer: entity,
          message: text,
          replyTo: replyToMsgId
            ? new Api.InputReplyToMessage({ replyToMsgId })
            : undefined,
        })
      );
    });

    log(`Saved draft in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error saving draft in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Get all drafts
 */
export async function getDrafts(): Promise<ApiResult<any[]>> {
  try {
    await enforceRateLimit("api_read");

    const client = getClient();

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(new Api.messages.GetAllDrafts());
    });

    log(`Fetched all drafts`);
    return { data: result?.updates || [], fromCache: false };
  } catch (error) {
    log(`Error fetching drafts:`, error);
    return { data: [], fromCache: false };
  }
}

/**
 * Clear draft in a chat
 */
export async function clearDraft(chatId: string): Promise<{ success: boolean }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.SaveDraft({
          peer: entity,
          message: "",
        })
      );
    });

    log(`Cleared draft in chat ${chatId}`);
    return { success: true };
  } catch (error) {
    log(`Error clearing draft in chat ${chatId}:`, error);
    return { success: false };
  }
}

/**
 * Create a poll in a chat
 */
export async function createPoll(
  chatId: string,
  question: string,
  options: string[],
  anonymous?: boolean,
  multipleChoice?: boolean
): Promise<{ id: number }> {
  try {
    await enforceRateLimit("api_write");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    const poll = new Api.Poll({
      id: bigInt(Math.floor(Math.random() * 1e16)),
      question: new Api.TextWithEntities({ text: question, entities: [] }),
      answers: options.map(
        (opt, idx) =>
          new Api.PollAnswer({
            text: new Api.TextWithEntities({ text: opt, entities: [] }),
            option: Buffer.from([idx]),
          })
      ),
      publicVoters: !anonymous,
      multipleChoice: multipleChoice || false,
    });

    const media = new Api.InputMediaPoll({ poll });

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media,
          message: "",
          randomId: bigInt(Math.floor(Math.random() * 1e16)),
        })
      );
    });

    const updates = result as Api.Updates;
    const messageId = updates.updates.find(
      (u): u is Api.UpdateMessageID => u instanceof Api.UpdateMessageID
    )?.id || 0;

    log(`Created poll in chat ${chatId}, message ID: ${messageId}`);
    return { id: messageId };
  } catch (error) {
    log(`Error creating poll in chat ${chatId}:`, error);
    throw error;
  }
}

/**
 * List topics in a forum/supergroup
 */
export async function listTopics(chatId: string): Promise<ApiResult<any[]>> {
  try {
    await enforceRateLimit("api_read");

    const client = getClient();
    const entity = await client.getClient().getInputEntity(chatId);

    if (!("channelId" in entity)) {
      log(`Chat ${chatId} is not a channel/supergroup`);
      return { data: [], fromCache: false };
    }

    const result = await client.withFloodWaitHandling(async () => {
      return await client.getClient().invoke(
        new Api.channels.GetForumTopics({
          channel: entity as Api.InputChannel,
          offsetDate: 0,
          offsetId: 0,
          offsetTopic: 0,
          limit: 100,
        })
      );
    });

    const topics = "topics" in result ? result.topics : [];
    log(`Fetched ${topics.length} topics from chat ${chatId}`);
    return { data: topics, fromCache: false };
  } catch (error) {
    log(`Error fetching topics from chat ${chatId}:`, error);
    return { data: [], fromCache: false };
  }
}

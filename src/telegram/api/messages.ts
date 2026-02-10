// Telegram Messages API — raw TDLib wrappers for message-related operations.
import type TdLibClient from '../tdlib-client';
import type { TdMessage } from '../types';

/**
 * Get chat history (messages in reverse chronological order).
 */
export async function getChatHistory(
  client: TdLibClient,
  chatId: number,
  limit: number,
  fromMessageId: number = 0,
  offset: number = 0
): Promise<TdMessage[]> {
  const response = await client.send({
    '@type': 'getChatHistory',
    chat_id: chatId,
    from_message_id: fromMessageId,
    offset,
    limit,
    only_local: false,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Get a single message by chat and message ID.
 */
export async function getMessage(
  client: TdLibClient,
  chatId: number,
  messageId: number
): Promise<TdMessage | null> {
  try {
    const response = await client.send({
      '@type': 'getMessage',
      chat_id: chatId,
      message_id: messageId,
    });
    return response as unknown as TdMessage;
  } catch {
    return null;
  }
}

/**
 * Send a text message to a chat.
 */
export async function sendMessage(
  client: TdLibClient,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: Record<string, unknown> = {
    chat_id: chatId,
    input_message_content: {
      '@type': 'inputMessageText',
      text: {
        '@type': 'formattedText',
        text,
      },
    },
  };

  if (replyToMessageId) {
    request.reply_to = {
      '@type': 'inputMessageReplyToMessage',
      message_id: replyToMessageId,
    };
  }

  const response = await client.send({ '@type': 'sendMessage', ...request });
  return response as unknown as TdMessage;
}

/**
 * Search messages in a specific chat.
 */
export async function searchChatMessages(
  client: TdLibClient,
  chatId: number,
  query: string,
  limit: number = 20,
  fromMessageId: number = 0
): Promise<TdMessage[]> {
  const response = await client.send({
    '@type': 'searchChatMessages',
    chat_id: chatId,
    query,
    from_message_id: fromMessageId,
    offset: 0,
    limit,
    sender_id: null,
    filter: null,
    message_thread_id: 0,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Search messages across all chats.
 */
export async function searchMessages(
  client: TdLibClient,
  query: string,
  limit: number = 20,
  offsetDate: number = 0,
  offsetChatId: number = 0,
  offsetMessageId: number = 0
): Promise<TdMessage[]> {
  const response = await client.send({
    '@type': 'searchMessages',
    chat_list: { '@type': 'chatListMain' },
    only_in_channels: false,
    query,
    offset_date: offsetDate,
    offset_chat_id: offsetChatId,
    offset_message_id: offsetMessageId,
    limit,
    filter: null,
    min_date: 0,
    max_date: 0,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Forward messages from one chat to another.
 */
export async function forwardMessages(
  client: TdLibClient,
  chatId: number,
  fromChatId: number,
  messageIds: number[]
): Promise<TdMessage[]> {
  const response = await client.send({
    '@type': 'forwardMessages',
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_ids: messageIds,
    send_copy: false,
    remove_caption: false,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Mark messages as read in a chat.
 */
export async function viewMessages(
  client: TdLibClient,
  chatId: number,
  messageIds: number[]
): Promise<void> {
  await client.send({
    '@type': 'viewMessages',
    chat_id: chatId,
    message_ids: messageIds,
    force_read: true,
  });
}

/**
 * Get pinned messages in a chat.
 */
export async function getChatPinnedMessage(
  client: TdLibClient,
  chatId: number
): Promise<TdMessage | null> {
  try {
    const response = await client.send({
      '@type': 'getChatPinnedMessage',
      chat_id: chatId,
    });
    return response as unknown as TdMessage;
  } catch {
    return null;
  }
}

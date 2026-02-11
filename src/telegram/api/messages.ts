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
 * TDLib method: sendMessage chat_id:int53 message_thread_id:int53 reply_to:InputMessageReplyTo options:messageSendOptions input_message_content:InputMessageContent = Message
 */
export async function sendMessage(
  client: TdLibClient,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: Record<string, unknown> = {
    chat_id: chatId,
    topic_id: null,
    options: null,
    input_message_content: {
      '@type': 'inputMessageText',
      text: { '@type': 'formattedText', text },
    },
  };

  if (replyToMessageId) {
    request.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId };
  }

  const response = await client.send({ '@type': 'sendMessage', ...request });
  return response as unknown as TdMessage;
}

/**
 * Search messages in a specific chat.
 * TDLib method: searchChatMessages chat_id:int53 query:string from_message_id:int53 offset:int32 limit:int32 sender_id:MessageSender filter:SearchMessagesFilter topic_id:int53 saved_messages_topic_id:int53 = FoundChatMessages
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
    topic_id: null,
    saved_messages_topic_id: null,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Search messages across all chats.
 * TDLib method: searchMessages chat_list:ChatList only_in_channels:Bool query:string offset:string limit:int32 filter:SearchMessagesFilter min_date:int32 max_date:int32 = FoundMessages
 */
export async function searchMessages(
  client: TdLibClient,
  query: string,
  limit: number = 20,
  offset: string = ''
): Promise<{ messages: TdMessage[]; next_offset?: string }> {
  const response = await client.send({
    '@type': 'searchMessages',
    chat_list: { '@type': 'chatListMain' },
    only_in_channels: false,
    query,
    offset,
    limit,
    filter: null,
    min_date: 0,
    max_date: 0,
  });

  const result = response as { messages?: TdMessage[]; next_offset?: string };
  return { messages: result.messages || [], next_offset: result.next_offset };
}

/**
 * Forward messages from one chat to another.
 * TDLib method: forwardMessages chat_id:int53 topic_id:int53 from_chat_id:int53 message_ids:vector<int53> options:messageSendOptions send_copy:Bool remove_caption:Bool = Messages
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
    topic_id: null,
    from_chat_id: fromChatId,
    message_ids: messageIds,
    options: null,
    send_copy: false,
    remove_caption: false,
  });

  return (response as { messages?: TdMessage[] }).messages || [];
}

/**
 * Mark messages as read in a chat.
 * TDLib method: viewMessages chat_id:int53 message_ids:vector<int53> source:MessageSource force_read:Bool = Ok
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
    source: { '@type': 'messageSourceChatHistory' },
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
    const response = await client.send({ '@type': 'getChatPinnedMessage', chat_id: chatId });
    return response as unknown as TdMessage;
  } catch {
    return null;
  }
}

/**
 * Edit a text message.
 */
export async function editMessageText(
  client: TdLibClient,
  chatId: number,
  messageId: number,
  text: string
): Promise<TdMessage> {
  const response = await client.send({
    '@type': 'editMessageText',
    chat_id: chatId,
    message_id: messageId,
    input_message_content: {
      '@type': 'inputMessageText',
      text: { '@type': 'formattedText', text },
    },
  });
  return response as unknown as TdMessage;
}

/**
 * Delete messages from a chat.
 */
export async function deleteMessages(
  client: TdLibClient,
  chatId: number,
  messageIds: number[],
  revoke: boolean = true
): Promise<void> {
  await client.send({
    '@type': 'deleteMessages',
    chat_id: chatId,
    message_ids: messageIds,
    revoke,
  });
}

/**
 * Pin a message in a chat.
 */
export async function pinChatMessage(
  client: TdLibClient,
  chatId: number,
  messageId: number,
  disableNotification: boolean = false,
  onlyForSelf: boolean = false
): Promise<void> {
  await client.send({
    '@type': 'pinChatMessage',
    chat_id: chatId,
    message_id: messageId,
    disable_notification: disableNotification,
    only_for_self: onlyForSelf,
  });
}

/**
 * Unpin a message in a chat.
 */
export async function unpinChatMessage(
  client: TdLibClient,
  chatId: number,
  messageId: number
): Promise<void> {
  await client.send({ '@type': 'unpinChatMessage', chat_id: chatId, message_id: messageId });
}

/**
 * Get a shareable link to a specific message.
 * TDLib method: getMessageLink chat_id:int53 message_id:int53 media_timestamp:int32 for_album:Bool in_message_thread:Bool = MessageLink
 */
export async function getMessageLink(
  client: TdLibClient,
  chatId: number,
  messageId: number
): Promise<{ link?: string }> {
  try {
    const response = await client.send({
      '@type': 'getMessageLink',
      chat_id: chatId,
      message_id: messageId,
      media_timestamp: 0,
      for_album: false,
      in_message_thread: false,
    });
    return response as { link?: string };
  } catch {
    return {};
  }
}

/**
 * Add a reaction emoji to a message.
 */
export async function addMessageReaction(
  client: TdLibClient,
  chatId: number,
  messageId: number,
  emoji: string,
  isBig: boolean = false
): Promise<void> {
  await client.send({
    '@type': 'addMessageReaction',
    chat_id: chatId,
    message_id: messageId,
    reaction_type: { '@type': 'reactionTypeEmoji', emoji },
    is_big: isBig,
    update_recent_reactions: true,
  });
}

/**
 * Remove a reaction from a message.
 */
export async function removeMessageReaction(
  client: TdLibClient,
  chatId: number,
  messageId: number,
  emoji: string
): Promise<void> {
  await client.send({
    '@type': 'removeMessageReaction',
    chat_id: chatId,
    message_id: messageId,
    reaction_type: { '@type': 'reactionTypeEmoji', emoji },
  });
}

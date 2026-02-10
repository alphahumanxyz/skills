// Telegram Chats API — raw TDLib wrappers for chat-related operations.
import type TdLibClient from '../tdlib-client';
import type { TdResponse } from '../tdlib-client';
import type { TdChat } from '../types';

/**
 * Load chats from the main chat list. Triggers updateNewChat for each chat.
 */
export async function loadChats(client: TdLibClient, limit: number = 20): Promise<TdResponse> {
  return await client.send({
    '@type': 'loadChats',
    chat_list: { '@type': 'chatListMain' },
    limit,
  });
}

/**
 * Get chat IDs from the main chat list.
 */
export async function getChats(client: TdLibClient): Promise<{ chat_ids?: number[] }> {
  return (await client.send({
    '@type': 'getChats',
    chat_list: { '@type': 'chatListMain' },
  })) as { chat_ids?: number[] };
}

/**
 * Get a single chat by ID.
 */
export async function getChat(client: TdLibClient, chatId: number): Promise<TdChat> {
  return (await client.send({ '@type': 'getChat', chat_id: chatId })) as unknown as TdChat;
}

/**
 * Search public chats by query string (channels, bots, public groups).
 */
export async function searchPublicChats(
  client: TdLibClient,
  query: string
): Promise<{ chat_ids?: number[] }> {
  return (await client.send({
    '@type': 'searchPublicChats',
    query,
  })) as { chat_ids?: number[] };
}

/**
 * Search the user's chats by title/username.
 */
export async function searchChats(
  client: TdLibClient,
  query: string,
  limit: number = 20
): Promise<{ chat_ids?: number[] }> {
  return (await client.send({
    '@type': 'searchChats',
    query,
    limit,
  })) as { chat_ids?: number[] };
}

/**
 * Get supergroup or channel full info (member count, description, etc.).
 */
export async function getSupergroupFullInfo(
  client: TdLibClient,
  supergroupId: number
): Promise<Record<string, unknown> | null> {
  try {
    const response = await client.send({
      '@type': 'getSupergroupFullInfo',
      supergroup_id: supergroupId,
    });
    return response as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get basic group full info (member list, etc.).
 */
export async function getBasicGroupFullInfo(
  client: TdLibClient,
  basicGroupId: number
): Promise<Record<string, unknown> | null> {
  try {
    const response = await client.send({
      '@type': 'getBasicGroupFullInfo',
      basic_group_id: basicGroupId,
    });
    return response as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

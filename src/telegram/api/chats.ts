// Telegram Chats API — raw TDLib wrappers for chat-related operations.
import type TdLibClient from '../tdlib-client';
import type { TdResponse } from '../tdlib-client';
import type { TdChat } from '../types';

/**
 * Load chats from the main chat list. Triggers updateNewChat for each chat.
 */
export async function loadChats(client: TdLibClient, limit: number = 20): Promise<TdResponse> {
  return await client.send({ '@type': 'loadChats', chat_list: { '@type': 'chatListMain' }, limit });
}

/**
 * Get chat IDs from the main chat list.
 * TDLib method: getChats chat_list:ChatList limit:int32 = Chats
 */
export async function getChats(
  client: TdLibClient,
  limit: number = 100
): Promise<{ chat_ids?: number[] }> {
  return (await client.send({
    '@type': 'getChats',
    chat_list: { '@type': 'chatListMain' },
    limit,
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
  return (await client.send({ '@type': 'searchPublicChats', query })) as { chat_ids?: number[] };
}

/**
 * Search the user's chats by title/username.
 */
export async function searchChats(
  client: TdLibClient,
  query: string,
  limit: number = 20
): Promise<{ chat_ids?: number[] }> {
  return (await client.send({ '@type': 'searchChats', query, limit })) as { chat_ids?: number[] };
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

/**
 * Create a private (DM) chat with a user.
 */
export async function createPrivateChat(
  client: TdLibClient,
  userId: number
): Promise<Record<string, unknown>> {
  const response = await client.send({
    '@type': 'createPrivateChat',
    user_id: userId,
    force: false,
  });
  return response as Record<string, unknown>;
}

/**
 * Create a new basic group chat.
 * TDLib method: createNewBasicGroupChat user_ids:vector<int53> title:string message_auto_delete_time:int32 = Chat
 */
export async function createNewBasicGroupChat(
  client: TdLibClient,
  userIds: number[],
  title: string
): Promise<Record<string, unknown>> {
  const response = await client.send({
    '@type': 'createNewBasicGroupChat',
    user_ids: userIds,
    title,
    message_auto_delete_time: 0,
  });
  return response as Record<string, unknown>;
}

/**
 * Create a new supergroup or channel.
 * TDLib method: createNewSupergroupChat title:string is_forum:Bool is_channel:Bool description:string location:chatLocation message_auto_delete_time:int32 for_import:Bool = Chat
 */
export async function createNewSupergroupChat(
  client: TdLibClient,
  title: string,
  isChannel: boolean,
  description?: string
): Promise<Record<string, unknown>> {
  const response = await client.send({
    '@type': 'createNewSupergroupChat',
    title,
    is_forum: false,
    is_channel: isChannel,
    description: description || '',
    location: null,
    message_auto_delete_time: 0,
    for_import: false,
  });
  return response as Record<string, unknown>;
}

/**
 * Join a chat by invite link.
 */
export async function joinChatByInviteLink(
  client: TdLibClient,
  inviteLink: string
): Promise<Record<string, unknown>> {
  const response = await client.send({ '@type': 'joinChatByInviteLink', invite_link: inviteLink });
  return response as Record<string, unknown>;
}

/**
 * Leave a group or channel chat.
 */
export async function leaveChat(client: TdLibClient, chatId: number): Promise<void> {
  await client.send({ '@type': 'leaveChat', chat_id: chatId });
}

/**
 * Set a chat's title.
 */
export async function setChatTitle(
  client: TdLibClient,
  chatId: number,
  title: string
): Promise<void> {
  await client.send({ '@type': 'setChatTitle', chat_id: chatId, title });
}

/**
 * Set chat notification settings (mute/unmute).
 */
export async function setChatNotificationSettings(
  client: TdLibClient,
  chatId: number,
  muteFor: number
): Promise<void> {
  await client.send({
    '@type': 'setChatNotificationSettings',
    chat_id: chatId,
    notification_settings: {
      '@type': 'chatNotificationSettings',
      use_default_mute_for: false,
      mute_for: muteFor,
    },
  });
}

/**
 * Create a chat invite link.
 */
export async function createChatInviteLink(
  client: TdLibClient,
  chatId: number,
  name?: string,
  memberLimit?: number
): Promise<{ invite_link?: string; name?: string }> {
  const response = await client.send({
    '@type': 'createChatInviteLink',
    chat_id: chatId,
    name: name || '',
    expiration_date: 0,
    member_limit: memberLimit || 0,
    creates_join_request: false,
  });
  return response as { invite_link?: string; name?: string };
}

/**
 * Set default permissions for a group chat.
 */
export async function setChatPermissions(
  client: TdLibClient,
  chatId: number,
  permissions: Record<string, boolean>
): Promise<void> {
  await client.send({
    '@type': 'setChatPermissions',
    chat_id: chatId,
    permissions: { '@type': 'chatPermissions', ...permissions },
  });
}

// Telegram Members API — raw TDLib wrappers for chat member operations.
import type TdLibClient from '../tdlib-client';

/**
 * Get members of a supergroup/channel.
 */
export async function getSupergroupMembers(
  client: TdLibClient,
  supergroupId: number,
  filter?: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ total_count?: number; members?: Record<string, unknown>[] }> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'getSupergroupMembers',
    supergroup_id: supergroupId,
    offset,
    limit,
  };

  if (filter === 'administrators') {
    request.filter = { '@type': 'supergroupMembersFilterAdministrators' };
  } else if (filter === 'banned') {
    request.filter = { '@type': 'supergroupMembersFilterBanned' };
  } else if (filter === 'bots') {
    request.filter = { '@type': 'supergroupMembersFilterBots' };
  } else if (filter === 'restricted') {
    request.filter = { '@type': 'supergroupMembersFilterRestricted' };
  } else {
    request.filter = { '@type': 'supergroupMembersFilterRecent' };
  }

  const response = await client.send(request);
  return response as { total_count?: number; members?: Record<string, unknown>[] };
}

/**
 * Search members of a chat (basic group or supergroup) by name/username.
 */
export async function searchChatMembers(
  client: TdLibClient,
  chatId: number,
  query: string = '',
  limit: number = 50,
  filter?: string
): Promise<{ total_count?: number; members?: Record<string, unknown>[] }> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'searchChatMembers',
    chat_id: chatId,
    query,
    limit,
  };

  if (filter === 'administrators') {
    request.filter = { '@type': 'chatMembersFilterAdministrators' };
  } else if (filter === 'banned') {
    request.filter = { '@type': 'chatMembersFilterBanned' };
  } else if (filter === 'bots') {
    request.filter = { '@type': 'chatMembersFilterBots' };
  } else if (filter === 'restricted') {
    request.filter = { '@type': 'chatMembersFilterRestricted' };
  }

  const response = await client.send(request);
  return response as { total_count?: number; members?: Record<string, unknown>[] };
}

/**
 * Add a single user to a group chat.
 */
export async function addChatMember(
  client: TdLibClient,
  chatId: number,
  userId: number,
  forwardLimit: number = 100
): Promise<void> {
  await client.send({
    '@type': 'addChatMember',
    chat_id: chatId,
    user_id: userId,
    forward_limit: forwardLimit,
  });
}

/**
 * Add multiple users to a group chat.
 */
export async function addChatMembers(
  client: TdLibClient,
  chatId: number,
  userIds: number[]
): Promise<void> {
  await client.send({ '@type': 'addChatMembers', chat_id: chatId, user_ids: userIds });
}

/**
 * Ban a member from a chat (sets status to chatMemberStatusBanned).
 */
export async function banChatMember(
  client: TdLibClient,
  chatId: number,
  memberId: number,
  memberType: 'user' | 'chat' = 'user'
): Promise<void> {
  const senderId =
    memberType === 'chat'
      ? { '@type': 'messageSenderChat', chat_id: memberId }
      : { '@type': 'messageSenderUser', user_id: memberId };

  await client.send({
    '@type': 'setChatMemberStatus',
    chat_id: chatId,
    member_id: senderId,
    status: { '@type': 'chatMemberStatusBanned' },
  });
}

/**
 * Set chat member status (promote/demote/restrict/etc.).
 */
export async function setChatMemberStatus(
  client: TdLibClient,
  chatId: number,
  memberId: number,
  status: Record<string, unknown>,
  memberType: 'user' | 'chat' = 'user'
): Promise<void> {
  const senderId =
    memberType === 'chat'
      ? { '@type': 'messageSenderChat', chat_id: memberId }
      : { '@type': 'messageSenderUser', user_id: memberId };

  await client.send({
    '@type': 'setChatMemberStatus',
    chat_id: chatId,
    member_id: senderId,
    status,
  });
}

import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildChat, buildEntityMap, toInputChannel, toInputPeer } from "../mtproto/builders.js";
import * as store from "../state/store.js";
import { apiDialogToTelegramChat, enforceRateLimit } from "../helpers.js";
import type { TelegramChat } from "../state/types.js";
import createDebug from "debug";

const log = createDebug("skill:telegram:api:chat");

export interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

/**
 * Get list of chats (cache-first)
 */
export async function getChats(limit = 20): Promise<ApiResult<TelegramChat[]>> {
  // Check cache first
  const cachedChats = store.getOrderedChats(limit);
  if (cachedChats.length > 0) {
    log("getChats: returning %d chats from cache", cachedChats.length);
    return { data: cachedChats, fromCache: true };
  }

  // Fetch from API
  log("getChats: fetching from API, limit=%d", limit);
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: 0,
          offsetId: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit,
          hash: bigInt(0),
        })
      )
    );

    if (!(result instanceof Api.messages.DialogsSlice) && !(result instanceof Api.messages.Dialogs)) {
      log("getChats: unexpected result type");
      return { data: [], fromCache: false };
    }

    // Build entity map for resolving references
    const entityMap = buildEntityMap(result.users, result.chats);

    // Convert dialogs to TelegramChat objects
    const chats: TelegramChat[] = result.dialogs.map((dialog) =>
      apiDialogToTelegramChat(dialog, entityMap)
    );

    // Update store
    store.addChats(chats);

    log("getChats: fetched %d chats from API", chats.length);
    return { data: chats, fromCache: false };
  } catch (error) {
    log("getChats: error fetching chats: %O", error);
    return { data: [], fromCache: false };
  }
}

/**
 * Get a specific chat by ID (cache-first)
 */
export async function getChat(chatId: string | number): Promise<ApiResult<TelegramChat | null>> {
  const chatIdStr = String(chatId);

  // Check cache first
  const cachedChat = store.getChatById(chatIdStr);
  if (cachedChat) {
    log("getChat: returning chat %s from cache", chatIdStr);
    return { data: cachedChat, fromCache: true };
  }

  // Fetch from API
  log("getChat: fetching chat %s from API", chatIdStr);
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const entity = await client.withFloodWaitHandling(() =>
      client.getEntity(chatId)
    );

    const chat = buildChat(entity);
    if (chat) {
      // Update store
      store.addChats([chat]);
      log("getChat: fetched chat %s from API", chatIdStr);
      return { data: chat, fromCache: false };
    }

    log("getChat: could not build chat from entity");
    return { data: null, fromCache: false };
  } catch (error) {
    log("getChat: error fetching chat %s: %O", chatIdStr, error);
    return { data: null, fromCache: false };
  }
}

/**
 * Create a new group chat
 */
export async function createGroup(title: string, userIds: string[]): Promise<ApiResult<TelegramChat | null>> {
  log("createGroup: title=%s, userIds=%o", title, userIds);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    // Get input users
    const inputUsers: Api.TypeInputUser[] = [];
    for (const userId of userIds) {
      const entity = await client.getEntity(userId);
      if (entity instanceof Api.User) {
        inputUsers.push(
          new Api.InputUser({
            userId: entity.id,
            accessHash: entity.accessHash || bigInt(0),
          })
        );
      }
    }

    if (inputUsers.length === 0) {
      log("createGroup: no valid users provided");
      return { data: null, fromCache: false };
    }

    // Create the chat
    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.messages.CreateChat({
          users: inputUsers,
          title,
        })
      )
    );

    // Extract the created chat from updates
    if (result.chats && result.chats.length > 0) {
      const chat = buildChat(result.chats[0]);
      if (chat) {
        store.addChats([chat]);
        log("createGroup: created group %s", chat.id);
        return { data: chat, fromCache: false };
      }
    }

    log("createGroup: could not extract chat from result");
    return { data: null, fromCache: false };
  } catch (error) {
    log("createGroup: error creating group: %O", error);
    return { data: null, fromCache: false };
  }
}

/**
 * Create a new channel or megagroup
 */
export async function createChannel(
  title: string,
  description?: string,
  megagroup = false
): Promise<ApiResult<TelegramChat | null>> {
  log("createChannel: title=%s, megagroup=%s", title, megagroup);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.channels.CreateChannel({
          title,
          about: description || "",
          megagroup,
          broadcast: !megagroup,
        })
      )
    );

    // Extract the created channel from updates
    if (result.chats && result.chats.length > 0) {
      const chat = buildChat(result.chats[0]);
      if (chat) {
        store.addChats([chat]);
        log("createChannel: created channel %s", chat.id);
        return { data: chat, fromCache: false };
      }
    }

    log("createChannel: could not extract chat from result");
    return { data: null, fromCache: false };
  } catch (error) {
    log("createChannel: error creating channel: %O", error);
    return { data: null, fromCache: false };
  }
}

/**
 * Invite users to a group or channel
 */
export async function inviteToGroup(chatId: string, userIds: string[]): Promise<ApiResult<boolean>> {
  log("inviteToGroup: chatId=%s, userIds=%o", chatId, userIds);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const chat = await getChat(chatId);

    if (!chat.data) {
      log("inviteToGroup: chat not found");
      return { data: false, fromCache: false };
    }

    // Get input users
    const inputUsers: Api.TypeInputUser[] = [];
    for (const userId of userIds) {
      const entity = await client.getEntity(userId);
      if (entity instanceof Api.User) {
        inputUsers.push(
          new Api.InputUser({
            userId: entity.id,
            accessHash: entity.accessHash || bigInt(0),
          })
        );
      }
    }

    if (inputUsers.length === 0) {
      log("inviteToGroup: no valid users provided");
      return { data: false, fromCache: false };
    }

    // Use different API based on chat type
    if (chat.data.type === "channel" || chat.data.type === "supergroup") {
      const inputChannel = toInputChannel(chatId);
      if (!inputChannel) {
        log("inviteToGroup: could not create input channel");
        return { data: false, fromCache: false };
      }

      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.channels.InviteToChannel({
            channel: inputChannel,
            users: inputUsers,
          })
        )
      );
    } else {
      // Regular group chat - add users one by one
      for (const inputUser of inputUsers) {
        await client.withFloodWaitHandling(() =>
          client.invoke(
            new Api.messages.AddChatUser({
              chatId: bigInt(chatId),
              userId: inputUser,
              fwdLimit: 100,
            })
          )
        );
      }
    }

    log("inviteToGroup: successfully invited users");
    return { data: true, fromCache: false };
  } catch (error) {
    log("inviteToGroup: error inviting users: %O", error);
    return { data: false, fromCache: false };
  }
}

/**
 * Edit chat title
 */
export async function editChatTitle(chatId: string, newTitle: string): Promise<ApiResult<boolean>> {
  log("editChatTitle: chatId=%s, newTitle=%s", chatId, newTitle);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const chat = await getChat(chatId);

    if (!chat.data) {
      log("editChatTitle: chat not found");
      return { data: false, fromCache: false };
    }

    if (chat.data.type === "channel" || chat.data.type === "supergroup") {
      const inputChannel = toInputChannel(chatId);
      if (!inputChannel) {
        log("editChatTitle: could not create input channel");
        return { data: false, fromCache: false };
      }

      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.channels.EditTitle({
            channel: inputChannel,
            title: newTitle,
          })
        )
      );
    } else {
      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.messages.EditChatTitle({
            chatId: bigInt(chatId),
            title: newTitle,
          })
        )
      );
    }

    // Update local cache
    if (chat.data) {
      chat.data.title = newTitle;
      store.addChats([chat.data]);
    }

    log("editChatTitle: successfully updated title");
    return { data: true, fromCache: false };
  } catch (error) {
    log("editChatTitle: error updating title: %O", error);
    return { data: false, fromCache: false };
  }
}

/**
 * Delete chat photo
 */
export async function deleteChatPhoto(chatId: string): Promise<ApiResult<boolean>> {
  log("deleteChatPhoto: chatId=%s", chatId);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const chat = await getChat(chatId);

    if (!chat.data) {
      log("deleteChatPhoto: chat not found");
      return { data: false, fromCache: false };
    }

    const emptyPhoto = new Api.InputChatPhotoEmpty();

    if (chat.data.type === "channel" || chat.data.type === "supergroup") {
      const inputChannel = toInputChannel(chatId);
      if (!inputChannel) {
        log("deleteChatPhoto: could not create input channel");
        return { data: false, fromCache: false };
      }

      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.channels.EditPhoto({
            channel: inputChannel,
            photo: emptyPhoto,
          })
        )
      );
    } else {
      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.messages.EditChatPhoto({
            chatId: bigInt(chatId),
            photo: emptyPhoto,
          })
        )
      );
    }

    log("deleteChatPhoto: successfully deleted photo");
    return { data: true, fromCache: false };
  } catch (error) {
    log("deleteChatPhoto: error deleting photo: %O", error);
    return { data: false, fromCache: false };
  }
}

/**
 * Leave a chat or channel
 */
export async function leaveChat(chatId: string): Promise<ApiResult<boolean>> {
  log("leaveChat: chatId=%s", chatId);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const chat = await getChat(chatId);

    if (!chat.data) {
      log("leaveChat: chat not found");
      return { data: false, fromCache: false };
    }

    if (chat.data.type === "channel" || chat.data.type === "supergroup") {
      const inputChannel = toInputChannel(chatId);
      if (!inputChannel) {
        log("leaveChat: could not create input channel");
        return { data: false, fromCache: false };
      }

      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.channels.LeaveChannel({
            channel: inputChannel,
          })
        )
      );
    } else {
      // For regular group chats, delete the current user
      const me = await client.getMe();
      await client.withFloodWaitHandling(() =>
        client.invoke(
          new Api.messages.DeleteChatUser({
            chatId: bigInt(chatId),
            userId: new Api.InputUser({
              userId: me.id,
              accessHash: me.accessHash || bigInt(0),
            }),
          })
        )
      );
    }

    // Remove from local cache
    store.removeChat(chatId);

    log("leaveChat: successfully left chat");
    return { data: true, fromCache: false };
  } catch (error) {
    log("leaveChat: error leaving chat: %O", error);
    return { data: false, fromCache: false };
  }
}

/**
 * Get invite link for a chat
 */
export async function getInviteLink(chatId: string): Promise<ApiResult<string | null>> {
  log("getInviteLink: chatId=%s", chatId);
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const inputPeer = toInputPeer(chatId);

    if (!inputPeer) {
      log("getInviteLink: could not create input peer");
      return { data: null, fromCache: false };
    }

    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.messages.ExportChatInvite({
          peer: inputPeer,
        })
      )
    );

    if (result instanceof Api.ChatInviteExported) {
      log("getInviteLink: got invite link");
      return { data: result.link, fromCache: false };
    }

    log("getInviteLink: unexpected result type");
    return { data: null, fromCache: false };
  } catch (error) {
    log("getInviteLink: error getting invite link: %O", error);
    return { data: null, fromCache: false };
  }
}

/**
 * Export a chat invite with custom parameters
 */
export async function exportChatInvite(
  chatId: string,
  expireDate?: number,
  usageLimit?: number
): Promise<ApiResult<string | null>> {
  log("exportChatInvite: chatId=%s, expireDate=%s, usageLimit=%s", chatId, expireDate, usageLimit);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputPeer = toInputPeer(chatId);

    if (!inputPeer) {
      log("exportChatInvite: could not create input peer");
      return { data: null, fromCache: false };
    }

    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.messages.ExportChatInvite({
          peer: inputPeer,
          expireDate,
          usageLimit,
        })
      )
    );

    if (result instanceof Api.ChatInviteExported) {
      log("exportChatInvite: exported invite link");
      return { data: result.link, fromCache: false };
    }

    log("exportChatInvite: unexpected result type");
    return { data: null, fromCache: false };
  } catch (error) {
    log("exportChatInvite: error exporting invite: %O", error);
    return { data: null, fromCache: false };
  }
}

/**
 * Import a chat invite by hash
 */
export async function importChatInvite(inviteHash: string): Promise<ApiResult<TelegramChat | null>> {
  log("importChatInvite: inviteHash=%s", inviteHash);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.messages.ImportChatInvite({
          hash: inviteHash,
        })
      )
    );

    // Extract the joined chat from updates
    if (result.chats && result.chats.length > 0) {
      const chat = buildChat(result.chats[0]);
      if (chat) {
        store.addChats([chat]);
        log("importChatInvite: joined chat %s", chat.id);
        return { data: chat, fromCache: false };
      }
    }

    log("importChatInvite: could not extract chat from result");
    return { data: null, fromCache: false };
  } catch (error) {
    log("importChatInvite: error importing invite: %O", error);
    return { data: null, fromCache: false };
  }
}

/**
 * Join a chat by invite link
 */
export async function joinChatByLink(inviteLink: string): Promise<ApiResult<TelegramChat | null>> {
  log("joinChatByLink: inviteLink=%s", inviteLink);

  // Extract hash from link (e.g., https://t.me/+ABC123 or https://t.me/joinchat/ABC123)
  const hashMatch = inviteLink.match(/(?:joinchat\/|\+)([A-Za-z0-9_-]+)/);
  if (!hashMatch) {
    log("joinChatByLink: could not extract hash from link");
    return { data: null, fromCache: false };
  }

  const hash = hashMatch[1];
  return importChatInvite(hash);
}

/**
 * Subscribe to a public channel by username
 */
export async function subscribePublicChannel(username: string): Promise<ApiResult<TelegramChat | null>> {
  log("subscribePublicChannel: username=%s", username);
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    // Remove @ prefix if present
    const cleanUsername = username.startsWith("@") ? username.slice(1) : username;

    // Get the channel entity first
    const entity = await client.withFloodWaitHandling(() =>
      client.getEntity(cleanUsername)
    );

    if (!(entity instanceof Api.Channel)) {
      log("subscribePublicChannel: entity is not a channel");
      return { data: null, fromCache: false };
    }

    // Join the channel
    const result = await client.withFloodWaitHandling(() =>
      client.invoke(
        new Api.channels.JoinChannel({
          channel: new Api.InputChannel({
            channelId: entity.id,
            accessHash: entity.accessHash || bigInt(0),
          }),
        })
      )
    );

    // Extract the joined channel from updates
    if (result.chats && result.chats.length > 0) {
      const chat = buildChat(result.chats[0]);
      if (chat) {
        store.addChats([chat]);
        log("subscribePublicChannel: joined channel %s", chat.id);
        return { data: chat, fromCache: false };
      }
    }

    log("subscribePublicChannel: could not extract chat from result");
    return { data: null, fromCache: false };
  } catch (error) {
    log("subscribePublicChannel: error subscribing to channel: %O", error);
    return { data: null, fromCache: false };
  }
}

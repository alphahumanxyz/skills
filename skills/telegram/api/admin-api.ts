import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildUser, toInputUser, toInputChannel } from "../mtproto/builders.js";
import { enforceRateLimit } from "../helpers.js";
import createDebug from "debug";

const debug = createDebug("telegram:api:admin");

interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

export async function getParticipants(
  chatId: string,
  limit = 100,
  filter = "recent"
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);

    let filterObj: Api.TypeChannelParticipantsFilter;
    switch (filter) {
      case "admins":
        filterObj = new Api.ChannelParticipantsAdmins();
        break;
      case "bots":
        filterObj = new Api.ChannelParticipantsBots();
        break;
      case "kicked":
        filterObj = new Api.ChannelParticipantsKicked({ q: "" });
        break;
      case "banned":
        filterObj = new Api.ChannelParticipantsBanned({ q: "" });
        break;
      default:
        filterObj = new Api.ChannelParticipantsRecent();
    }

    const result = await client.invoke(
      new Api.channels.GetParticipants({
        channel,
        filter: filterObj,
        offset: 0,
        limit,
        hash: bigInt.zero,
      })
    );

    if (!(result instanceof Api.channels.ChannelParticipants)) {
      return { data: [], fromCache: false };
    }

    const participants = result.participants.map((p, idx) => ({
      participant: p,
      user: result.users[idx] ? buildUser(result.users[idx]) : null,
    }));

    return { data: participants, fromCache: false };
  } catch (err) {
    debug("Error getting participants:", err);
    return { data: [], fromCache: false };
  }
}

export async function getAdmins(chatId: string): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);

    const result = await client.invoke(
      new Api.channels.GetParticipants({
        channel,
        filter: new Api.ChannelParticipantsAdmins(),
        offset: 0,
        limit: 100,
        hash: bigInt.zero,
      })
    );

    if (!(result instanceof Api.channels.ChannelParticipants)) {
      return { data: [], fromCache: false };
    }

    const admins = result.participants.map((p, idx) => ({
      participant: p,
      user: result.users[idx] ? buildUser(result.users[idx]) : null,
    }));

    return { data: admins, fromCache: false };
  } catch (err) {
    debug("Error getting admins:", err);
    return { data: [], fromCache: false };
  }
}

export async function getBannedUsers(
  chatId: string,
  limit = 100
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);

    const result = await client.invoke(
      new Api.channels.GetParticipants({
        channel,
        filter: new Api.ChannelParticipantsKicked({ q: "" }),
        offset: 0,
        limit,
        hash: bigInt.zero,
      })
    );

    if (!(result instanceof Api.channels.ChannelParticipants)) {
      return { data: [], fromCache: false };
    }

    const banned = result.participants.map((p, idx) => ({
      participant: p,
      user: result.users[idx] ? buildUser(result.users[idx]) : null,
    }));

    return { data: banned, fromCache: false };
  } catch (err) {
    debug("Error getting banned users:", err);
    return { data: [], fromCache: false };
  }
}

export async function promoteAdmin(
  chatId: string,
  userId: string,
  title?: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);
    const user = toInputUser(userId);

    const adminRights = new Api.ChatAdminRights({
      changeInfo: true,
      postMessages: true,
      editMessages: true,
      deleteMessages: true,
      banUsers: true,
      inviteUsers: true,
      pinMessages: true,
      addAdmins: false,
      anonymous: false,
      manageCall: true,
      other: true,
      manageTopics: true,
      postStories: true,
      editStories: true,
      deleteStories: true,
    });

    await client.invoke(
      new Api.channels.EditAdmin({
        channel,
        userId: user,
        adminRights,
        rank: title || "",
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error promoting admin:", err);
    return { data: false, fromCache: false };
  }
}

export async function demoteAdmin(
  chatId: string,
  userId: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);
    const user = toInputUser(userId);

    const noRights = new Api.ChatAdminRights({
      changeInfo: false,
      postMessages: false,
      editMessages: false,
      deleteMessages: false,
      banUsers: false,
      inviteUsers: false,
      pinMessages: false,
      addAdmins: false,
      anonymous: false,
      manageCall: false,
      other: false,
      manageTopics: false,
      postStories: false,
      editStories: false,
      deleteStories: false,
    });

    await client.invoke(
      new Api.channels.EditAdmin({
        channel,
        userId: user,
        adminRights: noRights,
        rank: "",
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error demoting admin:", err);
    return { data: false, fromCache: false };
  }
}

export async function banUser(
  chatId: string,
  userId: string,
  untilDate?: number
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);
    const user = toInputUser(userId);

    const bannedRights = new Api.ChatBannedRights({
      viewMessages: true,
      sendMessages: true,
      sendMedia: true,
      sendStickers: true,
      sendGifs: true,
      sendGames: true,
      sendInline: true,
      embedLinks: true,
      sendPolls: true,
      changeInfo: true,
      inviteUsers: true,
      pinMessages: true,
      manageTopics: true,
      sendPhotos: true,
      sendVideos: true,
      sendRoundvideos: true,
      sendAudios: true,
      sendVoices: true,
      sendDocs: true,
      sendPlain: true,
      untilDate: untilDate || 0,
    });

    await client.invoke(
      new Api.channels.EditBanned({
        channel,
        participant: user,
        bannedRights,
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error banning user:", err);
    return { data: false, fromCache: false };
  }
}

export async function unbanUser(
  chatId: string,
  userId: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);
    const user = toInputUser(userId);

    const noRestrictions = new Api.ChatBannedRights({
      viewMessages: false,
      sendMessages: false,
      sendMedia: false,
      sendStickers: false,
      sendGifs: false,
      sendGames: false,
      sendInline: false,
      embedLinks: false,
      sendPolls: false,
      changeInfo: false,
      inviteUsers: false,
      pinMessages: false,
      manageTopics: false,
      sendPhotos: false,
      sendVideos: false,
      sendRoundvideos: false,
      sendAudios: false,
      sendVoices: false,
      sendDocs: false,
      sendPlain: false,
      untilDate: 0,
    });

    await client.invoke(
      new Api.channels.EditBanned({
        channel,
        participant: user,
        bannedRights: noRestrictions,
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error unbanning user:", err);
    return { data: false, fromCache: false };
  }
}

export async function getRecentActions(
  chatId: string,
  limit = 20
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const channel = toInputChannel(chatId);

    const result = await client.invoke(
      new Api.channels.GetAdminLog({
        channel,
        q: "",
        eventsFilter: undefined,
        admins: undefined,
        maxId: bigInt.zero,
        minId: bigInt.zero,
        limit,
      })
    );

    const actions = result.events.map((event) => ({
      id: event.id.toString(),
      date: event.date,
      userId: event.userId.toString(),
      action: event.action,
    }));

    return { data: actions, fromCache: false };
  } catch (err) {
    debug("Error getting recent actions:", err);
    return { data: [], fromCache: false };
  }
}

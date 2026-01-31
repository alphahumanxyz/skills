import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildUser, toInputPeer } from "../mtproto/builders.js";
import { enforceRateLimit } from "../helpers.js";
import createDebug from "debug";

const debug = createDebug("telegram:api:search");

interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

export async function searchPublicChats(
  query: string,
  limit = 20
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.Search({ q: query, limit })
    );

    const chats = [
      ...result.chats.map((chat) => ({
        type: "chat" as const,
        id: chat.id.toString(),
        title: "title" in chat ? chat.title : undefined,
        username: "username" in chat ? chat.username : undefined,
        participantsCount:
          "participantsCount" in chat ? chat.participantsCount : undefined,
      })),
      ...result.users.map((user) => {
        const u = buildUser(user);
        return {
          type: "user" as const,
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
        };
      }),
    ];

    return { data: chats, fromCache: false };
  } catch (err) {
    debug("Error searching public chats:", err);
    return { data: [], fromCache: false };
  }
}

export async function searchMessages(
  query: string,
  chatId?: string,
  limit = 20
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();

    if (chatId) {
      const peer = toInputPeer(chatId, "channel");
      const result = await client.invoke(
        new Api.messages.Search({
          peer,
          q: query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetId: 0,
          addOffset: 0,
          limit,
          maxId: 0,
          minId: 0,
          hash: bigInt.zero,
        })
      );

      if (
        result instanceof Api.messages.Messages ||
        result instanceof Api.messages.MessagesSlice
      ) {
        const messages = result.messages.map((msg) => ({
          id: msg.id,
          message: "message" in msg ? msg.message : undefined,
          date: "date" in msg ? msg.date : undefined,
          fromId: "fromId" in msg ? msg.fromId?.toString() : undefined,
        }));

        return { data: messages, fromCache: false };
      }
    } else {
      const result = await client.invoke(
        new Api.messages.SearchGlobal({
          q: query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          offsetId: 0,
          limit,
        })
      );

      if (
        result instanceof Api.messages.Messages ||
        result instanceof Api.messages.MessagesSlice
      ) {
        const messages = result.messages.map((msg) => ({
          id: msg.id,
          message: "message" in msg ? msg.message : undefined,
          date: "date" in msg ? msg.date : undefined,
          fromId: "fromId" in msg ? msg.fromId?.toString() : undefined,
        }));

        return { data: messages, fromCache: false };
      }
    }

    return { data: [], fromCache: false };
  } catch (err) {
    debug("Error searching messages:", err);
    return { data: [], fromCache: false };
  }
}

export async function resolveUsername(
  username: string
): Promise<ApiResult<any | null>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const cleanUsername = username.replace(/^@/, "");

    const result = await client.invoke(
      new Api.contacts.ResolveUsername({ username: cleanUsername })
    );

    if (result.users.length > 0) {
      const user = buildUser(result.users[0]);
      return { data: { type: "user", ...user }, fromCache: false };
    }

    if (result.chats.length > 0) {
      const chat = result.chats[0];
      return {
        data: {
          type: "chat",
          id: chat.id.toString(),
          title: "title" in chat ? chat.title : undefined,
          username: "username" in chat ? chat.username : undefined,
        },
        fromCache: false,
      };
    }

    return { data: null, fromCache: false };
  } catch (err) {
    debug("Error resolving username:", err);
    return { data: null, fromCache: false };
  }
}

import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildUser, toInputUser, toInputPeer } from "../mtproto/builders.js";
import * as store from "../state/store.js";
import { enforceRateLimit } from "../helpers.js";
import type { TelegramUser } from "../state/types.js";
import createDebug from "debug";

const debug = createDebug("telegram:api:contact");

interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

export async function listContacts(limit = 20): Promise<ApiResult<TelegramUser[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.GetContacts({ hash: bigInt.zero })
    );

    if (!(result instanceof Api.contacts.Contacts)) {
      return { data: [], fromCache: false };
    }

    const users = result.users.slice(0, limit).map(buildUser);
    return { data: users, fromCache: false };
  } catch (err) {
    debug("Error listing contacts:", err);
    return { data: [], fromCache: false };
  }
}

export async function searchContacts(
  query: string,
  limit = 20
): Promise<ApiResult<TelegramUser[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.Search({ q: query, limit })
    );

    const users = result.users.slice(0, limit).map(buildUser);
    return { data: users, fromCache: false };
  } catch (err) {
    debug("Error searching contacts:", err);
    return { data: [], fromCache: false };
  }
}

export async function addContact(
  firstName: string,
  lastName: string,
  phoneNumber: string,
  userId?: string
): Promise<ApiResult<TelegramUser | null>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputUser = userId
      ? toInputUser(userId)
      : new Api.InputPhoneContact({
          clientId: bigInt.randBetween(bigInt.zero, bigInt("9999999999")),
          phone: phoneNumber,
          firstName,
          lastName,
        });

    const result = await client.invoke(
      new Api.contacts.AddContact({
        id: inputUser as Api.InputUser,
        firstName,
        lastName,
        phone: phoneNumber,
        addPhonePrivacyException: false,
      })
    );

    const user = result.users.length > 0 ? buildUser(result.users[0]) : null;
    return { data: user, fromCache: false };
  } catch (err) {
    debug("Error adding contact:", err);
    return { data: null, fromCache: false };
  }
}

export async function deleteContact(userId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputUser = toInputUser(userId);

    await client.invoke(
      new Api.contacts.DeleteContacts({ id: [inputUser] })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error deleting contact:", err);
    return { data: false, fromCache: false };
  }
}

export async function blockUser(userId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputPeer = toInputPeer(userId, "user");

    await client.invoke(new Api.contacts.Block({ id: inputPeer }));

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error blocking user:", err);
    return { data: false, fromCache: false };
  }
}

export async function unblockUser(userId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputPeer = toInputPeer(userId, "user");

    await client.invoke(new Api.contacts.Unblock({ id: inputPeer }));

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error unblocking user:", err);
    return { data: false, fromCache: false };
  }
}

export async function getBlockedUsers(limit = 100): Promise<ApiResult<TelegramUser[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.GetBlocked({ offset: 0, limit })
    );

    if (result instanceof Api.contacts.Blocked) {
      const users = result.users.map(buildUser);
      return { data: users, fromCache: false };
    } else if (result instanceof Api.contacts.BlockedSlice) {
      const users = result.users.map(buildUser);
      return { data: users, fromCache: false };
    }

    return { data: [], fromCache: false };
  } catch (err) {
    debug("Error getting blocked users:", err);
    return { data: [], fromCache: false };
  }
}

export async function getContactIds(): Promise<ApiResult<string[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.GetContactIDs({ hash: bigInt.zero })
    );

    const ids = result.map((id) => id.toString());
    return { data: ids, fromCache: false };
  } catch (err) {
    debug("Error getting contact IDs:", err);
    return { data: [], fromCache: false };
  }
}

export async function importContacts(
  contacts: Array<{ phone: string; firstName: string; lastName?: string }>
): Promise<ApiResult<TelegramUser[]>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const inputContacts = contacts.map(
      (contact) =>
        new Api.InputPhoneContact({
          clientId: bigInt.randBetween(bigInt.zero, bigInt("9999999999")),
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName || "",
        })
    );

    const result = await client.invoke(
      new Api.contacts.ImportContacts({ contacts: inputContacts })
    );

    const users = result.users.map(buildUser);
    return { data: users, fromCache: false };
  } catch (err) {
    debug("Error importing contacts:", err);
    return { data: [], fromCache: false };
  }
}

export async function exportContacts(): Promise<
  ApiResult<Array<{ phone: string; firstName: string; lastName: string }>>
> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.contacts.GetContacts({ hash: bigInt.zero })
    );

    if (!(result instanceof Api.contacts.Contacts)) {
      return { data: [], fromCache: false };
    }

    const exportedContacts = result.users.map((user) => {
      const u = buildUser(user);
      return {
        phone: u.phone || "",
        firstName: u.firstName || "",
        lastName: u.lastName || "",
      };
    });

    return { data: exportedContacts, fromCache: false };
  } catch (err) {
    debug("Error exporting contacts:", err);
    return { data: [], fromCache: false };
  }
}

export async function getDirectChatByContact(
  userId: string
): Promise<ApiResult<any | null>> {
  try {
    const state = store.getState();
    const chat = Object.values(state.chats).find(
      (c) => c.type === "private" && c.id === userId
    );

    return { data: chat || null, fromCache: true };
  } catch (err) {
    debug("Error getting direct chat by contact:", err);
    return { data: null, fromCache: true };
  }
}

export async function getContactChats(limit = 20): Promise<ApiResult<any[]>> {
  try {
    const state = store.getState();
    const contactChats = Object.values(state.chats)
      .filter((c) => c.type === "private")
      .slice(0, limit);

    return { data: contactChats, fromCache: true };
  } catch (err) {
    debug("Error getting contact chats:", err);
    return { data: [], fromCache: true };
  }
}

export async function getLastInteraction(
  userId: string
): Promise<ApiResult<any | null>> {
  try {
    const state = store.getState();
    const messages = Object.values(state.messages);

    const userMessages = messages
      .filter((msg) => msg.fromId === userId)
      .sort((a, b) => b.date - a.date);

    return { data: userMessages[0] || null, fromCache: true };
  } catch (err) {
    debug("Error getting last interaction:", err);
    return { data: null, fromCache: true };
  }
}

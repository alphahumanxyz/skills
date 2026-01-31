import { Api } from "telegram";
import bigInt from "big-integer";
import { getClient } from "../mtproto/client.js";
import { buildUser, toInputPeer, toInputUser } from "../mtproto/builders.js";
import * as store from "../state/store.js";
import { enforceRateLimit } from "../helpers.js";
import createDebug from "debug";

const debug = createDebug("telegram:api:settings");

interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

export async function muteChat(
  chatId: string,
  muteFor?: number
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const peer = toInputPeer(chatId, "channel");

    const muteUntil = muteFor ? Math.floor(Date.now() / 1000) + muteFor : 2147483647;

    await client.invoke(
      new Api.account.UpdateNotifySettings({
        peer: new Api.InputNotifyPeer({ peer }),
        settings: new Api.InputPeerNotifySettings({
          muteUntil,
        }),
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error muting chat:", err);
    return { data: false, fromCache: false };
  }
}

export async function unmuteChat(chatId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const peer = toInputPeer(chatId, "channel");

    await client.invoke(
      new Api.account.UpdateNotifySettings({
        peer: new Api.InputNotifyPeer({ peer }),
        settings: new Api.InputPeerNotifySettings({
          muteUntil: 0,
        }),
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error unmuting chat:", err);
    return { data: false, fromCache: false };
  }
}

export async function archiveChat(chatId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const peer = toInputPeer(chatId, "channel");

    await client.invoke(
      new Api.folders.EditPeerFolders({
        folderPeers: [
          new Api.InputFolderPeer({
            peer,
            folderId: 1,
          }),
        ],
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error archiving chat:", err);
    return { data: false, fromCache: false };
  }
}

export async function unarchiveChat(chatId: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();
    const peer = toInputPeer(chatId, "channel");

    await client.invoke(
      new Api.folders.EditPeerFolders({
        folderPeers: [
          new Api.InputFolderPeer({
            peer,
            folderId: 0,
          }),
        ],
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error unarchiving chat:", err);
    return { data: false, fromCache: false };
  }
}

export async function getPrivacySettings(): Promise<ApiResult<any>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();

    const [statusTimestamp, chatInvite, phoneCall, phoneP2P, forwards, profilePhoto, phoneNumber] =
      await Promise.all([
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyStatusTimestamp() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyChatInvite() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyPhoneCall() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyPhoneP2P() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyForwards() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyProfilePhoto() })
        ),
        client.invoke(
          new Api.account.GetPrivacy({ key: new Api.InputPrivacyKeyPhoneNumber() })
        ),
      ]);

    return {
      data: {
        statusTimestamp: statusTimestamp.rules,
        chatInvite: chatInvite.rules,
        phoneCall: phoneCall.rules,
        phoneP2P: phoneP2P.rules,
        forwards: forwards.rules,
        profilePhoto: profilePhoto.rules,
        phoneNumber: phoneNumber.rules,
      },
      fromCache: false,
    };
  } catch (err) {
    debug("Error getting privacy settings:", err);
    return { data: {}, fromCache: false };
  }
}

export async function setPrivacySettings(
  setting: string,
  value: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    let key: Api.TypeInputPrivacyKey;
    switch (setting) {
      case "statusTimestamp":
        key = new Api.InputPrivacyKeyStatusTimestamp();
        break;
      case "chatInvite":
        key = new Api.InputPrivacyKeyChatInvite();
        break;
      case "phoneCall":
        key = new Api.InputPrivacyKeyPhoneCall();
        break;
      case "phoneP2P":
        key = new Api.InputPrivacyKeyPhoneP2P();
        break;
      case "forwards":
        key = new Api.InputPrivacyKeyForwards();
        break;
      case "profilePhoto":
        key = new Api.InputPrivacyKeyProfilePhoto();
        break;
      case "phoneNumber":
        key = new Api.InputPrivacyKeyPhoneNumber();
        break;
      default:
        return { data: false, fromCache: false };
    }

    let rules: Api.TypeInputPrivacyRule[];
    switch (value) {
      case "everybody":
        rules = [new Api.InputPrivacyValueAllowAll()];
        break;
      case "contacts":
        rules = [new Api.InputPrivacyValueAllowContacts()];
        break;
      case "nobody":
        rules = [new Api.InputPrivacyValueDisallowAll()];
        break;
      default:
        return { data: false, fromCache: false };
    }

    await client.invoke(new Api.account.SetPrivacy({ key, rules }));

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error setting privacy:", err);
    return { data: false, fromCache: false };
  }
}

export async function getMe(): Promise<ApiResult<any>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const me = await client.getClient().getMe();

    if (!me) {
      return { data: null, fromCache: false };
    }

    const user = buildUser(me as Api.User);
    store.setCurrentUser(user);

    return { data: user, fromCache: false };
  } catch (err) {
    debug("Error getting me:", err);
    return { data: null, fromCache: false };
  }
}

export async function updateProfile(
  firstName?: string,
  lastName?: string,
  bio?: string
): Promise<ApiResult<any>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    await client.invoke(
      new Api.account.UpdateProfile({
        firstName,
        lastName,
        about: bio,
      })
    );

    const me = await getMe();
    return me;
  } catch (err) {
    debug("Error updating profile:", err);
    return { data: null, fromCache: false };
  }
}

export async function getUserPhotos(
  userId: string,
  limit = 20
): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const user = toInputUser(userId);

    const result = await client.invoke(
      new Api.photos.GetUserPhotos({
        userId: user,
        offset: 0,
        maxId: bigInt.zero,
        limit,
      })
    );

    if (result instanceof Api.photos.Photos) {
      return { data: result.photos, fromCache: false };
    } else if (result instanceof Api.photos.PhotosSlice) {
      return { data: result.photos, fromCache: false };
    }

    return { data: [], fromCache: false };
  } catch (err) {
    debug("Error getting user photos:", err);
    return { data: [], fromCache: false };
  }
}

export async function getUserStatus(userId: string): Promise<ApiResult<any>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const entity = await client.getClient().getEntity(userId);

    if ("status" in entity) {
      return { data: entity.status, fromCache: false };
    }

    return { data: null, fromCache: false };
  } catch (err) {
    debug("Error getting user status:", err);
    return { data: null, fromCache: false };
  }
}

export async function setProfilePhoto(
  filePath?: string,
  url?: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  debug("setProfilePhoto is a stub - file upload not yet implemented");
  return { data: false, fromCache: false };
}

export async function deleteProfilePhoto(photoId?: string): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    if (photoId) {
      const inputPhoto = new Api.InputPhoto({
        id: bigInt(photoId),
        accessHash: bigInt.zero,
        fileReference: Buffer.from([]),
      });

      await client.invoke(new Api.photos.DeletePhotos({ id: [inputPhoto] }));
    } else {
      await client.invoke(new Api.photos.UpdateProfilePhoto({ id: new Api.InputPhotoEmpty() }));
    }

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error deleting profile photo:", err);
    return { data: false, fromCache: false };
  }
}

export async function editChatPhoto(
  chatId: string,
  filePath?: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  debug("editChatPhoto is a stub - file upload not yet implemented");
  return { data: false, fromCache: false };
}

export async function getBotInfo(chatId: string): Promise<ApiResult<any>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const entity = await client.getClient().getEntity(chatId);

    if ("bot" in entity && entity.bot) {
      return {
        data: {
          id: entity.id.toString(),
          username: "username" in entity ? entity.username : undefined,
          firstName: "firstName" in entity ? entity.firstName : undefined,
          botInfoVersion: "botInfoVersion" in entity ? entity.botInfoVersion : undefined,
        },
        fromCache: false,
      };
    }

    return { data: null, fromCache: false };
  } catch (err) {
    debug("Error getting bot info:", err);
    return { data: null, fromCache: false };
  }
}

export async function setBotCommands(
  commands: Array<{ command: string; description: string }>,
  chatId?: string
): Promise<ApiResult<boolean>> {
  await enforceRateLimit("api_write");

  try {
    const client = getClient();

    const scope = chatId
      ? new Api.BotCommandScopePeer({
          peer: toInputPeer(chatId, "channel"),
        })
      : new Api.BotCommandScopeDefault();

    const botCommands = commands.map(
      (cmd) =>
        new Api.BotCommand({
          command: cmd.command,
          description: cmd.description,
        })
    );

    await client.invoke(
      new Api.bots.SetBotCommands({
        scope,
        langCode: "",
        commands: botCommands,
      })
    );

    return { data: true, fromCache: false };
  } catch (err) {
    debug("Error setting bot commands:", err);
    return { data: false, fromCache: false };
  }
}

export async function getStickerSets(limit = 20): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.messages.GetAllStickers({ hash: bigInt.zero })
    );

    if (result instanceof Api.messages.AllStickers) {
      const sets = result.sets.slice(0, limit).map((set) => ({
        id: set.id.toString(),
        title: set.title,
        short_name: set.shortName,
        count: set.count,
      }));

      return { data: sets, fromCache: false };
    }

    return { data: [], fromCache: false };
  } catch (err) {
    debug("Error getting sticker sets:", err);
    return { data: [], fromCache: false };
  }
}

export async function getGifSearch(query: string, limit = 20): Promise<ApiResult<any[]>> {
  await enforceRateLimit("api_read");

  try {
    const client = getClient();
    const result = await client.invoke(
      new Api.messages.SearchGifs({
        q: query,
        offset: 0,
      })
    );

    const gifs = result.results.slice(0, limit).map((gif) => ({
      id: "id" in gif ? gif.id : undefined,
      type: "type" in gif ? gif.type : undefined,
    }));

    return { data: gifs, fromCache: false };
  } catch (err) {
    debug("Error searching GIFs:", err);
    return { data: [], fromCache: false };
  }
}

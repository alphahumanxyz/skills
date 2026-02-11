// Telegram Folders API — raw TDLib wrappers for chat folder operations.
import type TdLibClient from '../tdlib-client';

/**
 * Get a single chat folder by ID.
 * TDLib method: getChatFolder chat_folder_id:int32 = ChatFolder
 */
export async function getChatFolder(
  client: TdLibClient,
  chatFolderId: number
): Promise<Record<string, unknown>> {
  const response = await client.send({ '@type': 'getChatFolder', chat_folder_id: chatFolderId });
  return response as Record<string, unknown>;
}

/**
 * Get all chat folders by reading cached folder infos from skill state
 * and fetching full details for each via getChatFolder.
 *
 * Note: TDLib does not have a "getChatFolders" method. Folder info is
 * delivered via updateChatFolders and cached in skill state.
 */
export async function getChatFolders(
  client: TdLibClient
): Promise<{ chat_folders: Record<string, unknown>[]; main_chat_list_position?: number }> {
  const s = globalThis.getTelegramSkillState();
  const folderInfos = s.chatFolderInfos || [];

  const folders: Record<string, unknown>[] = [];
  for (const info of folderInfos) {
    try {
      const folder = await getChatFolder(client, info.id);
      folders.push({ ...folder, id: info.id });
    } catch (err) {
      console.warn(`[telegram] Failed to get folder ${info.id}:`, err);
    }
  }

  return { chat_folders: folders };
}

/**
 * Create a new chat folder.
 */
export async function createChatFolder(
  client: TdLibClient,
  folder: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await client.send({ '@type': 'createChatFolder', folder });
  return response as Record<string, unknown>;
}

/**
 * Edit an existing chat folder.
 */
export async function editChatFolder(
  client: TdLibClient,
  chatFolderInfoId: number,
  folder: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await client.send({
    '@type': 'editChatFolder',
    chat_folder_id: chatFolderInfoId,
    folder,
  });
  return response as Record<string, unknown>;
}

/**
 * Delete a chat folder.
 */
export async function deleteChatFolder(
  client: TdLibClient,
  chatFolderInfoId: number,
  leaveChatIds: number[] = []
): Promise<void> {
  await client.send({
    '@type': 'deleteChatFolder',
    chat_folder_id: chatFolderInfoId,
    leave_chat_ids: leaveChatIds,
  });
}

/**
 * Get the list of chats in a chat folder.
 * TDLib does not have getChatFolderChats — we get the folder and return its chat IDs.
 */
export async function getChatFolderChats(
  client: TdLibClient,
  chatFolderId: number
): Promise<{ chat_ids: number[] }> {
  const folder = await getChatFolder(client, chatFolderId);
  const pinnedIds = (folder.pinned_chat_ids as number[]) || [];
  const includedIds = (folder.included_chat_ids as number[]) || [];

  // Combine pinned + included, deduplicating
  const allIds = [...new Set([...pinnedIds, ...includedIds])];
  return { chat_ids: allIds };
}

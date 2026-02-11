// Tools: get-chat-folders, create-chat-folder, edit-chat-folder, delete-chat-folder
// Chat folder management operations.
import * as api from '../api';

/**
 * Get all chat folders.
 */
export const getChatFoldersToolDefinition: ToolDefinition = {
  name: 'get-chat-folders',
  description: 'List all Telegram chat folders (filters) configured for the account.',
  input_schema: { type: 'object', properties: {}, required: [] },
  async execute(): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const result = await api.getChatFolders(s.client);
      const folders = (result.chat_folders || []).map((folder: Record<string, unknown>) => {
        // chatFolder.name is a chatFolderName object: { text: { text: "..." } }
        const nameObj = folder.name as { text?: { text?: string } } | undefined;
        const title = nameObj?.text?.text ?? (folder.title as string) ?? '';
        return {
          id: folder.id,
          title,
          icon_name: (folder.icon as Record<string, unknown>)?.name,
          included_chat_count: (folder.included_chat_ids as number[])?.length ?? 0,
          excluded_chat_count: (folder.excluded_chat_ids as number[])?.length ?? 0,
        };
      });

      return JSON.stringify({ success: true, count: folders.length, folders });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Create a new chat folder.
 */
export const createChatFolderToolDefinition: ToolDefinition = {
  name: 'create-chat-folder',
  description:
    'Create a new Telegram chat folder. You can specify which chats to include/exclude and filter settings.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The folder title (required)' },
      included_chat_ids: {
        type: 'string',
        description: 'Comma-separated list of chat IDs to include',
      },
      excluded_chat_ids: {
        type: 'string',
        description: 'Comma-separated list of chat IDs to exclude',
      },
      include_contacts: {
        type: 'string',
        description: 'Include contacts (true/false). Default: false',
        enum: ['true', 'false'],
      },
      include_non_contacts: {
        type: 'string',
        description: 'Include non-contacts (true/false). Default: false',
        enum: ['true', 'false'],
      },
      include_groups: {
        type: 'string',
        description: 'Include groups (true/false). Default: false',
        enum: ['true', 'false'],
      },
      include_channels: {
        type: 'string',
        description: 'Include channels (true/false). Default: false',
        enum: ['true', 'false'],
      },
      include_bots: {
        type: 'string',
        description: 'Include bots (true/false). Default: false',
        enum: ['true', 'false'],
      },
    },
    required: ['title'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const title = args.title as string;
      if (!title) return JSON.stringify({ success: false, error: 'title is required' });

      const folder: Record<string, unknown> = {
        '@type': 'chatFolder',
        name: {
          '@type': 'chatFolderName',
          text: { '@type': 'formattedText', text: title },
          animate_custom_emoji: false,
        },
        included_chat_ids: args.included_chat_ids
          ? (args.included_chat_ids as string).split(',').map(id => parseInt(id.trim(), 10))
          : [],
        excluded_chat_ids: args.excluded_chat_ids
          ? (args.excluded_chat_ids as string).split(',').map(id => parseInt(id.trim(), 10))
          : [],
        pinned_chat_ids: [],
        include_contacts: args.include_contacts === 'true',
        include_non_contacts: args.include_non_contacts === 'true',
        include_groups: args.include_groups === 'true',
        include_channels: args.include_channels === 'true',
        include_bots: args.include_bots === 'true',
      };

      const result = await api.createChatFolder(s.client, folder);

      return JSON.stringify({
        success: true,
        folder: {
          id: (result as { chat_folder_info?: { id?: number } }).chat_folder_info?.id,
          title,
        },
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Edit an existing chat folder.
 */
export const editChatFolderToolDefinition: ToolDefinition = {
  name: 'edit-chat-folder',
  description:
    'Edit an existing Telegram chat folder. Change title, included/excluded chats, or filter settings.',
  input_schema: {
    type: 'object',
    properties: {
      folder_id: { type: 'string', description: 'The folder ID to edit (required)' },
      title: { type: 'string', description: 'New folder title (optional)' },
      included_chat_ids: {
        type: 'string',
        description: 'Comma-separated list of chat IDs to include (replaces existing)',
      },
      excluded_chat_ids: {
        type: 'string',
        description: 'Comma-separated list of chat IDs to exclude (replaces existing)',
      },
      include_contacts: {
        type: 'string',
        description: 'Include contacts (true/false)',
        enum: ['true', 'false'],
      },
      include_non_contacts: {
        type: 'string',
        description: 'Include non-contacts (true/false)',
        enum: ['true', 'false'],
      },
      include_groups: {
        type: 'string',
        description: 'Include groups (true/false)',
        enum: ['true', 'false'],
      },
      include_channels: {
        type: 'string',
        description: 'Include channels (true/false)',
        enum: ['true', 'false'],
      },
      include_bots: {
        type: 'string',
        description: 'Include bots (true/false)',
        enum: ['true', 'false'],
      },
    },
    required: ['folder_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const folderId = args.folder_id as string;
      if (!folderId) return JSON.stringify({ success: false, error: 'folder_id is required' });

      const folder: Record<string, unknown> = { '@type': 'chatFolder' };

      if (args.title) {
        folder.name = {
          '@type': 'chatFolderName',
          text: { '@type': 'formattedText', text: args.title as string },
          animate_custom_emoji: false,
        };
      }
      if (args.included_chat_ids) {
        folder.included_chat_ids = (args.included_chat_ids as string)
          .split(',')
          .map(id => parseInt(id.trim(), 10));
      }
      if (args.excluded_chat_ids) {
        folder.excluded_chat_ids = (args.excluded_chat_ids as string)
          .split(',')
          .map(id => parseInt(id.trim(), 10));
      }
      if (args.include_contacts !== undefined)
        folder.include_contacts = args.include_contacts === 'true';
      if (args.include_non_contacts !== undefined)
        folder.include_non_contacts = args.include_non_contacts === 'true';
      if (args.include_groups !== undefined) folder.include_groups = args.include_groups === 'true';
      if (args.include_channels !== undefined)
        folder.include_channels = args.include_channels === 'true';
      if (args.include_bots !== undefined) folder.include_bots = args.include_bots === 'true';

      await api.editChatFolder(s.client, parseInt(folderId, 10), folder);

      return JSON.stringify({ success: true, folder_id: folderId, action: 'edited' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

/**
 * Delete a chat folder.
 */
export const deleteChatFolderToolDefinition: ToolDefinition = {
  name: 'delete-chat-folder',
  description: 'Delete a Telegram chat folder. Chats in the folder are not affected.',
  input_schema: {
    type: 'object',
    properties: {
      folder_id: { type: 'string', description: 'The folder ID to delete (required)' },
    },
    required: ['folder_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const s = globalThis.getTelegramSkillState();
      if (!s.client) throw new Error('Telegram is not connected. Complete setup and log in first.');

      const folderId = args.folder_id as string;
      if (!folderId) return JSON.stringify({ success: false, error: 'folder_id is required' });

      await api.deleteChatFolder(s.client, parseInt(folderId, 10));

      return JSON.stringify({ success: true, folder_id: folderId, action: 'deleted' });
    } catch (err) {
      return JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

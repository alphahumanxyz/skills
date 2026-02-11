import { appendBlocksTool } from './append-blocks';
import { appendTextTool } from './append-text';
import { createCommentTool } from './create-comment';
import { createDatabaseTool } from './create-database';
import { createPageTool } from './create-page';
import { deleteBlockTool } from './delete-block';
import { deletePageTool } from './delete-page';
import { getBlockTool } from './get-block';
import { getBlockChildrenTool } from './get-block-children';
import { getDatabaseTool } from './get-database';
import { getPageTool } from './get-page';
import { getPageContentTool } from './get-page-content';
import { getUserTool } from './get-user';
import { listAllDatabasesTool } from './list-all-databases';
import { listAllPagesTool } from './list-all-pages';
import { listCommentsTool } from './list-comments';
import { listUsersTool } from './list-users';
import { queryDatabaseTool } from './query-database';
import { searchTool } from './search';
import { summarizePagesTool } from './summarize-pages';
import { syncNowTool } from './sync-now';
import { syncStatusTool } from './sync-status';
import { updateBlockTool } from './update-block';
import { updateDatabaseTool } from './update-database';
import { updatePageTool } from './update-page';

export const tools: ToolDefinition[] = [
  appendBlocksTool,
  appendTextTool,
  createCommentTool,
  createDatabaseTool,
  createPageTool,
  deleteBlockTool,
  deletePageTool,
  getBlockTool,
  getBlockChildrenTool,
  getDatabaseTool,
  getPageTool,
  getPageContentTool,
  getUserTool,
  listAllDatabasesTool,
  listAllPagesTool,
  listCommentsTool,
  listUsersTool,
  queryDatabaseTool,
  searchTool,
  summarizePagesTool,
  syncNowTool,
  syncStatusTool,
  updateBlockTool,
  updateDatabaseTool,
  updatePageTool,
];

export default tools;

import { getEmailTool } from './get-email';
import { getEmailsTool } from './get-emails';
import { getLabelsTool } from './get-labels';
import { getProfileTool } from './get-profile';
import { markEmailTool } from './mark-email';
import { searchEmailsTool } from './search-emails';
import { sendEmailTool } from './send-email';

export const tools: ToolDefinition[] = [
  getEmailTool,
  getEmailsTool,
  getLabelsTool,
  getProfileTool,
  markEmailTool,
  searchEmailsTool,
  sendEmailTool,
];

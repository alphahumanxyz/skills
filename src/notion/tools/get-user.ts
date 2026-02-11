// Tool: notion-get-user
import { notionApi } from '../api/index';
import { formatApiError, formatUserSummary } from '../helpers';

export const getUserTool: ToolDefinition = {
  name: 'get-user',
  description: 'Get a user by their ID.',
  input_schema: {
    type: 'object',
    properties: { user_id: { type: 'string', description: 'The user ID' } },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const userId = (args.user_id as string) || '';
      if (!userId) {
        return JSON.stringify({ error: 'user_id is required' });
      }

      const user = await notionApi.getUser(userId);

      return JSON.stringify(formatUserSummary(user as Record<string, unknown>));
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

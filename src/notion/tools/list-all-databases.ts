// Tool: notion-list-all-databases
import { notionApi } from '../api/index';
import { formatApiError, formatDatabaseSummary } from '../helpers';

export const listAllDatabasesTool: ToolDefinition = {
  name: 'list-all-databases',
  description: 'List all databases in the workspace that the integration has access to.',
  input_schema: {
    type: 'object',
    properties: {
      page_size: { type: 'number', description: 'Number of results (default 20, max 100)' },
    },
  },
  execute(args: Record<string, unknown>): string {
    try {
      const pageSize = Math.min((args.page_size as number) || 20, 100);

      const result = notionApi.listAllDatabases(pageSize);

      const databases = result.results.map((item: Record<string, unknown>) =>
        formatDatabaseSummary(item)
      );
      return JSON.stringify({ count: databases.length, has_more: result.has_more, databases });
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

// Tool: notion-list-all-pages
import { notionApi } from '../api/index';
import { formatApiError, formatPageSummary } from '../helpers';

export const listAllPagesTool: ToolDefinition = {
  name: 'list-all-pages',
  description: 'List all pages in the workspace that the integration has access to.',
  input_schema: {
    type: 'object',
    properties: {
      page_size: {
        type: 'number',
        description: 'Number of results to return (default 20, max 100)',
      },
    },
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const pageSize = Math.min((args.page_size as number) || 20, 100);

      const result = await notionApi.search({
        filter: { property: 'object', value: 'page' },
        page_size: pageSize,
      });

      const pages = result.results.map((item: Record<string, unknown>) => formatPageSummary(item));

      return JSON.stringify({ count: pages.length, has_more: result.has_more, pages });
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

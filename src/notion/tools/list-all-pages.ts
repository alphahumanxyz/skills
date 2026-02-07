// Tool: notion-list-all-pages
import { getApi, n } from '../types';

export const listAllPagesTool: ToolDefinition = {
  name: 'notion-list-all-pages',
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
  execute(args: Record<string, unknown>): string {
    try {
      const { formatPageSummary } = n();
      const pageSize = Math.min((args.page_size as number) || 20, 100);

      const result = getApi().search({
        filter: { property: 'object', value: 'page' },
        page_size: pageSize,
      });

      const pages = result.results.map((item: Record<string, unknown>) => formatPageSummary(item));

      return JSON.stringify({ count: pages.length, has_more: result.has_more, pages });
    } catch (e) {
      return JSON.stringify({ error: n().formatApiError(e) });
    }
  },
};

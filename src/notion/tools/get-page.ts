// Tool: notion-get-page
import { getApi, n } from '../types';

export const getPageTool: ToolDefinition = {
  name: 'notion-get-page',
  description:
    "Get a page's metadata and properties by its ID. " +
    'Use notion-get-page-content to get the actual content/blocks.',
  input_schema: {
    type: 'object',
    properties: {
      page_id: { type: 'string', description: 'The page ID (UUID format, with or without dashes)' },
    },
    required: ['page_id'],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const { formatPageSummary } = n();
      const pageId = (args.page_id as string) || '';
      if (!pageId) {
        return JSON.stringify({ error: 'page_id is required' });
      }

      const page = getApi().getPage(pageId);

      return JSON.stringify({
        ...formatPageSummary(page as Record<string, unknown>),
        properties: (page as Record<string, unknown>).properties,
      });
    } catch (e) {
      return JSON.stringify({ error: n().formatApiError(e) });
    }
  },
};

// Tool: notion-get-page-content
import { notionApi } from '../api/index';
import { formatApiError, formatBlockSummary } from '../helpers';

export const getPageContentTool: ToolDefinition = {
  name: 'get-page-content',
  description:
    'Get the content blocks of a page. Returns the text and structure of the page. ' +
    'Use recursive=true to also get nested blocks.',
  input_schema: {
    type: 'object',
    properties: {
      page_id: { type: 'string', description: 'The page ID to get content from' },
      recursive: {
        type: 'string',
        enum: ['true', 'false'],
        description: 'Whether to fetch nested blocks (default: false)',
      },
      page_size: {
        type: 'number',
        description: 'Number of blocks to return (default 50, max 100)',
      },
    },
    required: ['page_id'],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const pageId = (args.page_id as string) || '';
      const recursive = args.recursive === 'true';
      const pageSize = Math.min((args.page_size as number) || 50, 100);

      if (!pageId) {
        return JSON.stringify({ error: 'page_id is required' });
      }

      const result = notionApi.getPageContent(pageId, pageSize);

      const blocks = result.results.map((block: Record<string, unknown>) => {
        const summary = formatBlockSummary(block);

        if (recursive && block.has_children) {
          try {
            const children = notionApi.getBlockChildren(block.id as string, 50);
            return {
              ...summary,
              children: children.results.map((c: Record<string, unknown>) => formatBlockSummary(c)),
            };
          } catch {
            return { ...summary, children: [] };
          }
        }

        return summary;
      });

      return JSON.stringify({
        page_id: pageId,
        block_count: blocks.length,
        has_more: result.has_more,
        blocks,
      });
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

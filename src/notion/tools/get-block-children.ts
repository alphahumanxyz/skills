// Tool: notion-get-block-children
import { getApi, n } from '../types';

export const getBlockChildrenTool: ToolDefinition = {
  name: 'notion-get-block-children',
  description: 'Get the children blocks of a block or page.',
  input_schema: {
    type: 'object',
    properties: {
      block_id: { type: 'string', description: 'The parent block or page ID' },
      page_size: { type: 'number', description: 'Number of blocks (default 50, max 100)' },
    },
    required: ['block_id'],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const { formatBlockSummary } = n();
      const blockId = (args.block_id as string) || '';
      const pageSize = Math.min((args.page_size as number) || 50, 100);

      if (!blockId) {
        return JSON.stringify({ error: 'block_id is required' });
      }

      const result = getApi().getBlockChildren(blockId, pageSize);

      return JSON.stringify({
        parent_id: blockId,
        count: result.results.length,
        has_more: result.has_more,
        children: result.results.map((b: Record<string, unknown>) => formatBlockSummary(b)),
      });
    } catch (e) {
      return JSON.stringify({ error: n().formatApiError(e) });
    }
  },
};

// Tool: notion-delete-block
import { notionApi } from '../api/index';
import { formatApiError } from '../helpers';

export const deleteBlockTool: ToolDefinition = {
  name: 'delete-block',
  description: 'Delete a block. This permanently removes the block from Notion.',
  input_schema: {
    type: 'object',
    properties: { block_id: { type: 'string', description: 'The block ID to delete' } },
    required: ['block_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const blockId = (args.block_id as string) || '';
      if (!blockId) {
        return JSON.stringify({ error: 'block_id is required' });
      }

      await notionApi.deleteBlock(blockId);

      return JSON.stringify({ success: true, message: 'Block deleted', block_id: blockId });
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

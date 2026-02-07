// Tool: notion-append-text
import { getApi, n } from '../types';

export const appendTextTool: ToolDefinition = {
  name: 'notion-append-text',
  description:
    'Append text content to a page or block. Creates paragraph blocks with the given text.',
  input_schema: {
    type: 'object',
    properties: {
      block_id: { type: 'string', description: 'The page or block ID to append to' },
      text: { type: 'string', description: 'Text content to append' },
    },
    required: ['block_id', 'text'],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const { formatBlockSummary, buildParagraphBlock } = n();
      const blockId = (args.block_id as string) || '';
      const text = (args.text as string) || '';

      if (!blockId) {
        return JSON.stringify({ error: 'block_id is required' });
      }
      if (!text) {
        return JSON.stringify({ error: 'text is required' });
      }

      const paragraphs = text.split('\n').filter(p => p.trim());
      const children = paragraphs.map(buildParagraphBlock);

      const result = getApi().appendBlockChildren(blockId, children);

      return JSON.stringify({
        success: true,
        blocks_added: result.results.length,
        blocks: result.results.map((b: Record<string, unknown>) => formatBlockSummary(b)),
      });
    } catch (e) {
      return JSON.stringify({ error: n().formatApiError(e) });
    }
  },
};

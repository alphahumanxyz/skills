// Tool: notion-summarize-pages
// AI summarization is now handled by the backend server.
import '../skill-state';

export const summarizePagesTool: ToolDefinition = {
  name: 'notion-summarize-pages',
  description:
    'AI summarization of Notion pages is now handled by the backend server. ' +
    'Synced page content is submitted to the server which runs summarization.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    return JSON.stringify({
      success: false,
      error:
        'AI summarization has been moved to the backend server. ' +
        'Page content is synced and summaries are generated server-side.',
    });
  },
};

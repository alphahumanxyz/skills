// Tool: notion-summarize-pages
// Triggers AI summarization of synced pages and returns results
import '../skill-state';

export const summarizePagesTool: ToolDefinition = {
  name: 'notion-summarize-pages',
  description:
    'Run AI summarization on synced Notion pages that have content but no summary (or stale summaries). ' +
    'Requires a local model to be available. Returns count of pages summarized.',
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description:
          'Maximum number of pages to summarize in this batch. Defaults to the configured maxPagesPerContentSync.',
      },
    },
  },
  execute(args: Record<string, unknown>): string {
    try {
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Notion not connected. Complete OAuth setup first.',
        });
      }

      if (!model.isAvailable()) {
        return JSON.stringify({
          success: false,
          error: 'AI model not available. Ensure a local model is downloaded and loaded.',
          model_status: model.getStatus(),
        });
      }

      const s = globalThis.getNotionSkillState();
      const batchLimit =
        typeof args.limit === 'number' && args.limit > 0
          ? args.limit
          : s.config.maxPagesPerContentSync;

      const getPagesNeedingSummary = (globalThis as Record<string, unknown>)
        .getPagesNeedingSummary as
        | ((
            limit: number
          ) => Array<{
            id: string;
            title: string;
            content_text: string;
            url: string | null;
            last_edited_time: string;
            created_time: string;
          }>)
        | undefined;
      const updatePageAiSummary = (globalThis as Record<string, unknown>).updatePageAiSummary as
        | ((pageId: string, summary: string) => void)
        | undefined;

      if (!getPagesNeedingSummary || !updatePageAiSummary) {
        return JSON.stringify({ success: false, error: 'Database helpers not available.' });
      }

      const pages = getPagesNeedingSummary(batchLimit);

      if (pages.length === 0) {
        return JSON.stringify({
          success: true,
          message: 'All pages are already summarized.',
          summarized: 0,
          failed: 0,
        });
      }

      let summarized = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const page of pages) {
        try {
          const content =
            page.content_text.length > 8000
              ? page.content_text.substring(0, 8000) + '\n...(truncated)'
              : page.content_text;

          const prompt = `Summarize this Notion page titled "${page.title}" concisely. Focus on the key points and main purpose of the page.\n\n${content}`;
          const summary = model.summarize(prompt, { maxTokens: 300 });

          if (summary && summary.trim()) {
            updatePageAiSummary(page.id, summary.trim());

            model.submitSummary({
              summary: summary.trim(),
              category: 'research',
              dataSource: 'notion',
              sentiment: 'neutral',
              metadata: {
                pageId: page.id,
                pageTitle: page.title,
                pageUrl: page.url,
                lastEditedTime: page.last_edited_time,
                createdTime: page.created_time,
                contentLength: page.content_text.length,
              },
            });

            summarized++;
          }
        } catch (e) {
          failed++;
          errors.push(`${page.title}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return JSON.stringify({
        success: true,
        summarized,
        failed,
        total_candidates: pages.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};

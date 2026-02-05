// Shared type for Notion helper functions exposed on globalThis

export interface NotionGlobals {
  notionFetch(endpoint: string, options?: { method?: string; body?: unknown }): unknown;
  formatApiError(error: unknown): string;
  formatRichText(richText: unknown[]): string;
  formatPageTitle(page: Record<string, unknown>): string;
  formatPageSummary(page: Record<string, unknown>): Record<string, unknown>;
  formatDatabaseSummary(db: Record<string, unknown>): Record<string, unknown>;
  formatBlockSummary(block: Record<string, unknown>): Record<string, unknown>;
  formatBlockContent(block: Record<string, unknown>): string;
  formatUserSummary(user: Record<string, unknown>): Record<string, unknown>;
  buildRichText(text: string): unknown[];
  buildParagraphBlock(text: string): Record<string, unknown>;
}

// Access helpers on globalThis (call inside execute(), not at module scope)
export function n(): NotionGlobals {
  return globalThis as unknown as NotionGlobals;
}

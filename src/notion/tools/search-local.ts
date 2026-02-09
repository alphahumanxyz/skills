// Tool: notion-search-local
// Query local SQLite pages and databases by title/content
import {
  getLocalDatabases,
  getLocalDatabaseRows,
  getLocalPages,
} from '../db-helpers';
import { formatApiError } from '../helpers';

export const searchLocalTool: ToolDefinition = {
  name: 'search-local',
  description:
    'Search locally synced Notion pages, databases, and database rows by title or content. ' +
    'Much faster than API search — queries the local SQLite cache. ' +
    'Data is updated every 20 minutes via background sync.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to match against titles, content text, and row properties',
      },
      type: {
        type: 'string',
        enum: ['page', 'database', 'database_row', 'all'],
        description: 'Filter by type (default: all)',
      },
      database_id: {
        type: 'string',
        description: 'When type is "database_row", filter rows to this specific database ID',
      },
      limit: { type: 'number', description: 'Maximum results to return (default: 20, max: 100)' },
      include_content: {
        type: 'boolean',
        description: 'Include full content_text in results (default: false, only snippet)',
      },
      include_archived: {
        type: 'boolean',
        description: 'Include archived pages/databases (default: false)',
      },
    },
    required: ['query'],
  },
  execute(args: Record<string, unknown>): string {
    try {

      const query = (args.query as string) || '';
      if (!query) {
        return JSON.stringify({ error: 'Search query is required' });
      }

      const type = (args.type as string) || 'all';
      const limit = Math.min((args.limit as number) || 20, 100);
      const includeContent = (args.include_content as boolean) || false;
      const includeArchived = (args.include_archived as boolean) || false;
      const databaseId = args.database_id as string | undefined;

      const results: unknown[] = [];

      // Search pages
      if (type === 'page' || type === 'all') {
        const pages = getLocalPages({ query, limit, includeArchived }) as Array<{
          id: string;
          title: string;
          url: string | null;
          icon: string | null;
          parent_type: string;
          last_edited_time: string;
          archived: number;
          content_text: string | null;
        }>;

        for (const page of pages) {
          const entry: Record<string, unknown> = {
            object: 'page',
            id: page.id,
            title: page.title,
            url: page.url,
            icon: page.icon,
            last_edited_time: page.last_edited_time,
            parent_type: page.parent_type,
          };

          if (page.archived) entry.archived = true;

          if (includeContent && page.content_text) {
            entry.content = page.content_text;
          } else if (page.content_text) {
            // Provide a snippet (first 200 chars)
            entry.snippet = page.content_text.substring(0, 200);
            if (page.content_text.length > 200) {
              entry.snippet += '...';
            }
          }

          results.push(entry);
        }
      }

      // Search databases
      if (type === 'database' || type === 'all') {
        const databases = getLocalDatabases({ query, limit }) as Array<{
          id: string;
          title: string;
          description: string | null;
          url: string | null;
          icon: string | null;
          property_count: number;
          last_edited_time: string;
        }>;

        for (const database of databases) {
          results.push({
            object: 'database',
            id: database.id,
            title: database.title,
            description: database.description,
            url: database.url,
            icon: database.icon,
            property_count: database.property_count,
            last_edited_time: database.last_edited_time,
          });
        }
      }

      // Search database rows
      if (type === 'database_row' || type === 'all') {
        const rows = getLocalDatabaseRows({ query, limit, includeArchived, databaseId }) as Array<{
          id: string;
          database_id: string;
          title: string;
          url: string | null;
          icon: string | null;
          properties_json: string | null;
          properties_text: string | null;
          last_edited_time: string;
          archived: number;
        }>;

        for (const row of rows) {
          const entry: Record<string, unknown> = {
            object: 'database_row',
            id: row.id,
            database_id: row.database_id,
            title: row.title,
            url: row.url,
            icon: row.icon,
            last_edited_time: row.last_edited_time,
          };

          if (row.archived) entry.archived = true;

          if (includeContent && row.properties_json) {
            try {
              entry.properties = JSON.parse(row.properties_json);
            } catch {
              entry.properties_text = row.properties_text;
            }
          } else if (row.properties_text) {
            // Provide a snippet of the flattened properties text
            entry.snippet = row.properties_text.substring(0, 200);
            if (row.properties_text.length > 200) {
              entry.snippet += '...';
            }
          }

          results.push(entry);
        }
      }

      // Sort combined results by last_edited_time descending
      results.sort((a, b) => {
        const aTime = (a as Record<string, unknown>).last_edited_time as string;
        const bTime = (b as Record<string, unknown>).last_edited_time as string;
        return bTime.localeCompare(aTime);
      });

      // Apply limit to combined results
      const trimmed = results.slice(0, limit);

      return JSON.stringify({ query, count: trimmed.length, results: trimmed });
    } catch (e) {
      return JSON.stringify({ error: formatApiError(e) });
    }
  },
};

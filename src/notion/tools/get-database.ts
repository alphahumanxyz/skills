// Tool: notion-get-database
import { getApi, n } from '../types';

export const getDatabaseTool: ToolDefinition = {
  name: 'notion-get-database',
  description: "Get a database's schema and metadata. Shows all properties and their types.",
  input_schema: {
    type: 'object',
    properties: { database_id: { type: 'string', description: 'The database ID' } },
    required: ['database_id'],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const { formatDatabaseSummary } = n();
      const api = getApi();
      const databaseId = (args.database_id as string) || '';
      if (!databaseId) {
        return JSON.stringify({ error: 'database_id is required' });
      }

      const dataSourceId = api.resolveDataSourceId(databaseId);
      const dsResult = api.getDataSource(dataSourceId);

      const dsRec = dsResult as Record<string, unknown>;
      const props = dsRec.properties as Record<string, unknown>;
      const schema: Record<string, unknown> = {};
      if (props) {
        for (const [name, prop] of Object.entries(props)) {
          const propData = prop as Record<string, unknown>;
          schema[name] = { type: propData.type, id: propData.id };
        }
      }

      return JSON.stringify({ ...formatDatabaseSummary(dsRec), schema });
    } catch (e) {
      return JSON.stringify({ error: n().formatApiError(e) });
    }
  },
};

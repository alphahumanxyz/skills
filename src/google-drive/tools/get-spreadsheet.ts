// Tool: google-drive-get-spreadsheet (Sheets API)
import '../state';
import { SHEETS_BASE } from '../types';

export const getSpreadsheetTool: ToolDefinition = {
  name: 'google-drive-get-spreadsheet',
  description:
    'Get Google Sheets spreadsheet metadata: title and sheet names. Use spreadsheet_id from Drive (file with mimeType application/vnd.google-apps.spreadsheet).',
  input_schema: {
    type: 'object',
    properties: {
      spreadsheet_id: {
        type: 'string',
        description: 'Spreadsheet ID (Drive file ID of the sheet)',
      },
    },
    required: ['spreadsheet_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const driveFetch = (globalThis as { driveFetch?: (e: string, o?: object) => any }).driveFetch;
      if (!driveFetch) {
        return JSON.stringify({ success: false, error: 'Drive API helper not available' });
      }
      if (!oauth.getCredential()) {
        return JSON.stringify({
          success: false,
          error: 'Google Drive not connected. Complete OAuth setup first.',
        });
      }
      const spreadsheetId = args.spreadsheet_id as string;
      if (!spreadsheetId) {
        return JSON.stringify({ success: false, error: 'spreadsheet_id is required' });
      }
      const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
      const response = driveFetch(path, { baseUrl: SHEETS_BASE });
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to get spreadsheet',
        });
      }
      const data = response.data as {
        spreadsheetId?: string;
        properties?: { title?: string };
        sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
      };
      const sheets = (data.sheets || []).map(
        (s: { properties?: { title?: string; sheetId?: number } }) => ({
          title: s.properties?.title,
          sheetId: s.properties?.sheetId,
        })
      );
      return JSON.stringify({
        success: true,
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title,
        sheets: sheets.map((s: { title?: string }) => s.title),
      });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};

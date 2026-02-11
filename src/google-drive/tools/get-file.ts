// Tool: google-drive-get-file
import '../state';

export const getFileTool: ToolDefinition = {
  name: 'google-drive-get-file',
  description:
    'Get file metadata or export content. For native Google Docs/Sheets, use export_format to get plain text or CSV.',
  input_schema: {
    type: 'object',
    properties: {
      file_id: { type: 'string', description: 'Drive file ID' },
      export_format: {
        type: 'string',
        description:
          'For Docs/Sheets: text/plain, text/html, application/pdf, or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (xlsx). Omit for metadata only.',
      },
    },
    required: ['file_id'],
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
      const fileId = args.file_id as string;
      const exportFormat = args.export_format as string | undefined;
      if (!fileId) {
        return JSON.stringify({ success: false, error: 'file_id is required' });
      }
      if (exportFormat) {
        const path = `/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportFormat)}`;
        // Export returns raw body (text/plain, etc.), not JSON — use oauth.fetch directly
        const response = await oauth.fetch(path, { method: 'GET', timeout: 30 });
        if (response.status >= 200 && response.status < 300) {
          return JSON.stringify({
            success: true,
            content: response.body,
            exported_as: exportFormat,
          });
        }
        let errMsg = 'Export failed';
        try {
          if (response.body) {
            const err = JSON.parse(response.body) as { error?: { message?: string } };
            errMsg = err.error?.message || errMsg;
          }
        } catch (_) {
          errMsg = response.body?.slice(0, 200) || errMsg;
        }
        return JSON.stringify({ success: false, error: errMsg });
      }
      const path = `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,createdTime`;
      const response = driveFetch(path);
      if (!response.success) {
        return JSON.stringify({
          success: false,
          error: response.error?.message || 'Failed to get file',
        });
      }
      return JSON.stringify({ success: true, file: response.data });
    } catch (e) {
      return JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
};

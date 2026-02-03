// Tool: update-server-url
// Change the monitored server URL at runtime.

declare const CONFIG: { serverUrl: string };
declare const store: { set: (key: string, value: unknown) => void };
declare function publishState(): void;

export const updateServerUrlTool: ToolDefinition = {
  name: 'update-server-url',
  description: 'Change the monitored server URL at runtime.',
  input_schema: {
    type: 'object',
    properties: { url: { type: 'string', description: 'New server URL to monitor' } },
    required: ['url'],
  },
  execute(args: Record<string, unknown>): string {
    const url = ((args.url as string) ?? '').trim();
    if (!url || !url.startsWith('http')) {
      return JSON.stringify({ error: 'Invalid URL — must start with http:// or https://' });
    }
    const oldUrl = CONFIG.serverUrl;
    CONFIG.serverUrl = url;
    store.set('config', CONFIG);
    console.log(`[server-ping] Server URL changed: ${oldUrl} -> ${url}`);
    publishState();
    return JSON.stringify({ success: true, oldUrl, newUrl: url });
  },
};

// Tool: sync-now — Trigger an immediate Slack sync (channels + history into DB).

export const syncNowTool: ToolDefinition = {
  name: 'sync_now',
  description:
    'Trigger an immediate sync of Slack channels and their recent messages into the skill database. ' +
    'Use this to refresh stored messages on demand. The skill also runs a periodic sync every 20 minutes.',
  input_schema: { type: 'object', properties: {}, required: [] },
  async execute(): Promise<string> {
    const config = state.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    const getStatus = (globalThis as Record<string, unknown>).getSlackSyncStatus as () => {
      lastSyncTime: number;
      syncInProgress: boolean;
      lastSyncChannels: number;
      lastSyncMessages: number;
    };
    const status = getStatus?.();
    if (status?.syncInProgress) {
      return JSON.stringify({
        ok: false,
        sync_in_progress: true,
        message: 'Sync already in progress. Try again in a moment.',
        last_sync_time:
          status.lastSyncTime > 0 ? new Date(status.lastSyncTime).toISOString() : null,
      });
    }

    const performSync = (globalThis as Record<string, unknown>).performSlackSync as () => void;
    if (typeof performSync !== 'function') {
      return JSON.stringify({ ok: false, error: 'Sync not available.' });
    }

    try {
      performSync();
      const after = getStatus?.();
      return JSON.stringify({
        ok: true,
        message: 'Sync completed.',
        last_sync_time: after?.lastSyncTime ? new Date(after.lastSyncTime).toISOString() : null,
        channels_synced: after?.lastSyncChannels ?? 0,
        messages_stored: after?.lastSyncMessages ?? 0,
      });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

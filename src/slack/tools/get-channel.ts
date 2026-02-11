// Tool: get-channel — Get detailed information about a Slack channel.

export const getChannelTool: ToolDefinition = {
  name: 'get_channel',
  description: 'Get detailed information about a Slack channel (name, topic, member count, etc.).',
  input_schema: {
    type: 'object',
    properties: {
      channel_id: { type: 'string', description: 'The channel ID (e.g. C1234567890).' },
    },
    required: ['channel_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const config = state.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    const channelId = args.channel_id as string;
    if (!channelId || typeof channelId !== 'string') {
      return JSON.stringify({ ok: false, error: 'channel_id is required.' });
    }

    try {
      const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
        method: string,
        endpoint: string,
        params?: Record<string, unknown>
      ) => Record<string, unknown>;

      const result = slackFetch('GET', '/conversations.info', { channel: channelId });
      const ch = result.channel as Record<string, unknown> | undefined;
      if (!ch) {
        return JSON.stringify({ ok: false, error: 'Channel not found.' });
      }

      const info = {
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        is_archived: ch.is_archived,
        topic: (ch.topic as Record<string, unknown>)?.value ?? '',
        purpose: (ch.purpose as Record<string, unknown>)?.value ?? '',
        num_members: ch.num_members,
        created: ch.created,
      };

      return JSON.stringify({ ok: true, channel: info });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

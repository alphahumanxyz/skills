// Tool: get-messages — Get messages from a Slack channel or DM (live API).

export const getMessagesTool: ToolDefinition = {
  name: 'get_messages',
  description: 'Get messages from a Slack channel or DM. Uses the live Slack API.',
  input_schema: {
    type: 'object',
    properties: {
      channel_id: {
        type: 'string',
        description: 'The channel or DM ID (e.g. C1234567890 or D1234567890).',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of messages to return (default 50, max 200).',
        default: 50,
      },
      oldest: {
        type: 'string',
        description: 'Optional Slack timestamp — only messages after this time.',
      },
      latest: {
        type: 'string',
        description: 'Optional Slack timestamp — only messages before this time.',
      },
    },
    required: ['channel_id'],
  },
  execute(args: Record<string, unknown>): string {
    const config = store.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    const channelId = args.channel_id as string;
    if (!channelId || typeof channelId !== 'string') {
      return JSON.stringify({ ok: false, error: 'channel_id is required.' });
    }

    try {
      const limit = Math.min(Number(args.limit) || 50, 200);
      const params: Record<string, unknown> = { channel: channelId, limit };
      if (args.oldest) params.oldest = args.oldest;
      if (args.latest) params.latest = args.latest;

      const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
        method: string,
        endpoint: string,
        params?: Record<string, unknown>
      ) => Record<string, unknown>;

      const result = slackFetch('GET', '/conversations.history', params);
      const rawMessages = (result.messages as Record<string, unknown>[]) || [];
      const messages = rawMessages.map(msg => ({
        ts: msg.ts,
        user: msg.user,
        text: msg.text,
        type: msg.type,
        subtype: msg.subtype,
        thread_ts: msg.thread_ts,
      }));

      return JSON.stringify({ ok: true, messages });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

// Tool: list-channels — List Slack channels (public and optionally private).

export const listChannelsTool: ToolDefinition = {
  name: 'list_channels',
  description:
    'List Slack channels (public and optionally private) so the agent can choose where to read or send messages.',
  input_schema: {
    type: 'object',
    properties: {
      include_private: {
        type: 'boolean',
        description: 'Include private channels (default false).',
        default: false,
      },
      include_archived: {
        type: 'boolean',
        description: 'Include archived channels (default false).',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of channels to return (default 50).',
        default: 50,
      },
    },
    required: [],
  },
  execute(args: Record<string, unknown>): string {
    const config = store.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    try {
      const includePrivate = !!args.include_private;
      const excludeArchived = !args.include_archived;
      const limit = Math.min(Number(args.limit) || 50, 200);
      const types = includePrivate ? 'public_channel,private_channel' : 'public_channel';

      const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
        method: string,
        endpoint: string,
        params?: Record<string, unknown>
      ) => Record<string, unknown>;

      const result = slackFetch('GET', '/conversations.list', {
        types,
        exclude_archived: excludeArchived,
        limit,
      });

      const rawChannels = (result.channels as Record<string, unknown>[]) || [];
      const channels = rawChannels.slice(0, limit).map(ch => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        is_archived: ch.is_archived,
        topic: (ch.topic as Record<string, unknown>)?.value ?? '',
        purpose: (ch.purpose as Record<string, unknown>)?.value ?? '',
        num_members: ch.num_members,
      }));

      return JSON.stringify({ ok: true, channels });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

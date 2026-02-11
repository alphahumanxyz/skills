// Tool: open-dm — Open or get a DM channel with a user by user ID.

export const openDmTool: ToolDefinition = {
  name: 'open_dm',
  description:
    'Open or get the DM channel ID for a Slack user. Use the returned channel_id with send_message or get_messages.',
  input_schema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'The Slack user ID (e.g. U1234567890).' },
    },
    required: ['user_id'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const config = state.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    const userId = args.user_id as string;
    if (!userId || typeof userId !== 'string') {
      return JSON.stringify({ ok: false, error: 'user_id is required.' });
    }

    try {
      const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
        method: string,
        endpoint: string,
        params?: Record<string, unknown>
      ) => Record<string, unknown>;

      const result = slackFetch('POST', '/conversations.open', { users: userId });
      const channel = result.channel as Record<string, unknown> | undefined;
      const channelId = channel?.id as string | undefined;
      if (!channelId) {
        return JSON.stringify({ ok: false, error: 'Could not open DM channel.' });
      }

      return JSON.stringify({ ok: true, channel_id: channelId, user_id: userId });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

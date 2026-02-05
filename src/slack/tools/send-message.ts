// Tool: send-message — Send a message to a Slack channel or DM.

export const sendMessageTool: ToolDefinition = {
  name: 'send_message',
  description: 'Send a message to a Slack channel or DM. Optionally reply in a thread.',
  input_schema: {
    type: 'object',
    properties: {
      channel_id: {
        type: 'string',
        description: 'The channel or DM ID to send the message to.',
      },
      text: {
        type: 'string',
        description: 'The message text to send.',
      },
      thread_ts: {
        type: 'string',
        description: 'Optional Slack timestamp of a message to reply to (thread).',
      },
    },
    required: ['channel_id', 'text'],
  },
  execute(args: Record<string, unknown>): string {
    const config = store.get('config') as { botToken?: string } | null;
    if (!config?.botToken) {
      return JSON.stringify({ ok: false, error: 'Slack not connected. Complete setup first.' });
    }

    const channelId = args.channel_id as string;
    const text = (args.text as string) ?? '';

    if (!channelId || typeof channelId !== 'string') {
      return JSON.stringify({ ok: false, error: 'channel_id is required.' });
    }
    if (!text || typeof text !== 'string') {
      return JSON.stringify({ ok: false, error: 'text is required.' });
    }

    try {
      const body: Record<string, unknown> = { channel: channelId, text };
      if (args.thread_ts && typeof args.thread_ts === 'string') {
        body.thread_ts = args.thread_ts;
      }

      const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
        method: string,
        endpoint: string,
        params?: Record<string, unknown>
      ) => Record<string, unknown>;

      const result = slackFetch('POST', '/chat.postMessage', body);
      const message = result.message as Record<string, unknown> | undefined;
      return JSON.stringify({
        ok: true,
        ts: message?.ts,
        channel: message?.channel ?? channelId,
        text: message?.text ?? text,
      });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

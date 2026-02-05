// Tool: get-stored-messages — Query messages received via real-time events (stored in DB).

export const getStoredMessagesTool: ToolDefinition = {
  name: 'get_stored_messages',
  description:
    'Query messages that were received via real-time events and stored in the skill DB. Use this to see what the bot has "heard" (DMs, @mentions, channel messages the bot is in).',
  input_schema: {
    type: 'object',
    properties: {
      channel_id: {
        type: 'string',
        description: 'Optional: filter by channel or DM ID.',
      },
      since: {
        type: 'string',
        description: 'Optional: ISO timestamp or Slack ts — only messages after this time.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of messages to return (default 50).',
        default: 50,
      },
    },
    required: [],
  },
  execute(args: Record<string, unknown>): string {
    try {
      const limit = Math.min(Number(args.limit) || 50, 200);
      const channelId = args.channel_id as string | undefined;
      const since = args.since as string | undefined;

      let sql = 'SELECT channel_id, user_id, ts, text, type, event_type, thread_ts, created_at FROM slack_messages';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (channelId) {
        conditions.push('channel_id = ?');
        params.push(channelId);
      }
      if (since) {
        // Support both ISO timestamp and Slack ts (e.g. "1234567890.123456")
        if (since.includes('.')) {
          conditions.push('ts >= ?');
        } else {
          conditions.push('created_at >= ?');
        }
        params.push(since);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = db.all(sql, params) as Record<string, unknown>[];
      const messages = rows.map(row => ({
        channel_id: row.channel_id,
        user_id: row.user_id,
        ts: row.ts,
        text: row.text,
        type: row.type,
        event_type: row.event_type,
        thread_ts: row.thread_ts,
        created_at: row.created_at,
      }));

      return JSON.stringify({ ok: true, messages });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

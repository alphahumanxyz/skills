// Tool: get-messages — Get messages from a Slack channel or DM (from DB; optional refresh from Slack API).
// Use globalThis.getMessageDisplayText at runtime (set by index.ts) so bundled skill works.

export const getMessagesTool: ToolDefinition = {
  name: 'get_messages',
  description:
    'Get messages from a Slack channel or DM. Reads from the skill DB (populated by sync). ' +
    'Use refresh_from_slack to fetch latest from Slack API and update the DB (avoids rate limits by default).',
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
        description: 'Optional Slack timestamp — only messages after this time (DB filter).',
      },
      latest: {
        type: 'string',
        description: 'Optional Slack timestamp — only messages before this time (DB filter).',
      },
      refresh_from_slack: {
        type: 'boolean',
        description:
          'If true, fetch latest from Slack API and merge into DB, then return from DB. Default false to avoid rate limits.',
        default: false,
      },
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

    const limit = Math.min(Number(args.limit) || 50, 200);
    const refreshFromSlack = !!args.refresh_from_slack;

    try {
      if (refreshFromSlack) {
        const slackFetch = (globalThis as Record<string, unknown>).slackApiFetch as (
          method: string,
          endpoint: string,
          params?: Record<string, unknown>
        ) => Record<string, unknown>;
        const params: Record<string, unknown> = { channel: channelId, limit: 200 };
        const result = slackFetch('GET', '/conversations.history', params);
        const rawMessages = (result.messages as Record<string, unknown>[]) || [];
        const now = new Date().toISOString();
        for (const msg of rawMessages) {
          const ts = msg.ts as string | number | undefined;
          const tsStr = typeof ts === 'number' ? String(ts) : ts;
          if (!tsStr) continue;
          const userId = msg.user as string | undefined;
          const getDisplayText = (globalThis as Record<string, unknown>).getMessageDisplayText as
            | ((m: Record<string, unknown>) => string)
            | undefined;
          const displayText =
            typeof getDisplayText === 'function'
              ? getDisplayText(msg)
              : ((msg.text as string) ?? '');
          const type = (msg.type as string) ?? 'message';
          const subtype = (msg.subtype as string) ?? null;
          const threadTs = (msg.thread_ts as string) ?? null;
          const blocksJson = msg.blocks ? JSON.stringify(msg.blocks) : null;
          const attachmentsJson = msg.attachments ? JSON.stringify(msg.attachments) : null;
          try {
            db.exec(
              `INSERT OR IGNORE INTO slack_messages (channel_id, user_id, ts, text, type, subtype, event_type, thread_ts, created_at, blocks_json, attachments_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                channelId,
                userId ?? null,
                tsStr,
                displayText,
                type,
                subtype,
                'message',
                threadTs,
                now,
                blocksJson,
                attachmentsJson,
              ]
            );
          } catch {
            // ignore duplicate or schema errors
          }
        }
      }

      const conditions: string[] = ['channel_id = ?'];
      const queryParams: unknown[] = [channelId];
      if (args.oldest) {
        conditions.push('ts >= ?');
        queryParams.push(args.oldest);
      }
      if (args.latest) {
        conditions.push('ts <= ?');
        queryParams.push(args.latest);
      }
      queryParams.push(limit);
      const rows = db.all(
        `SELECT user_id, ts, text, type, subtype, thread_ts, blocks_json, attachments_json FROM slack_messages
         WHERE ${conditions.join(' AND ')} ORDER BY ts DESC LIMIT ?`,
        queryParams
      ) as Record<string, unknown>[];

      const messages = rows.map(row => {
        let blocks: unknown = null;
        let attachments: unknown = null;
        try {
          if (row.blocks_json && typeof row.blocks_json === 'string')
            blocks = JSON.parse(row.blocks_json);
        } catch {
          // ignore
        }
        try {
          if (row.attachments_json && typeof row.attachments_json === 'string')
            attachments = JSON.parse(row.attachments_json);
        } catch {
          // ignore
        }
        return {
          ts: row.ts,
          user: row.user_id,
          text: row.text,
          type: row.type,
          subtype: row.subtype,
          thread_ts: row.thread_ts,
          blocks: blocks ?? undefined,
          attachments: attachments ?? undefined,
        };
      });

      return JSON.stringify({
        ok: true,
        messages,
        source: refreshFromSlack ? 'slack_then_db' : 'db',
      });
    } catch (e) {
      return JSON.stringify({ ok: false, error: String(e) });
    }
  },
};

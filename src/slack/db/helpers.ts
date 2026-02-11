// Database helpers for Slack skill

export function insertMessage(
  channelId: string,
  userId: string | null,
  ts: string,
  text: string,
  type: string,
  subtype: string | null,
  eventType: string,
  threadTs: string | null,
  createdAt: string,
  blocksJson: string | null,
  attachmentsJson: string | null
): void {
  db.exec(
    `INSERT OR IGNORE INTO slack_messages (channel_id, user_id, ts, text, type, subtype, event_type, thread_ts, created_at, blocks_json, attachments_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      channelId,
      userId,
      ts,
      text,
      type,
      subtype,
      eventType,
      threadTs,
      createdAt,
      blocksJson,
      attachmentsJson,
    ]
  );
}

export function deleteOlderThan(tsThreshold: string): void {
  db.exec('DELETE FROM slack_messages WHERE ts < ?', [tsThreshold]);
}

declare global {
  var slackDb: { insertMessage: typeof insertMessage; deleteOlderThan: typeof deleteOlderThan };
}
globalThis.slackDb = { insertMessage, deleteOlderThan };

// SQLite schema for Slack skill

export function initializeSchema(): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS slack_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      user_id TEXT,
      ts TEXT NOT NULL,
      text TEXT,
      type TEXT,
      subtype TEXT,
      event_type TEXT,
      thread_ts TEXT,
      created_at TEXT NOT NULL,
      blocks_json TEXT,
      attachments_json TEXT,
      UNIQUE(channel_id, ts)
    )`,
    []
  );
  try {
    db.exec('ALTER TABLE slack_messages ADD COLUMN blocks_json TEXT');
  } catch {
    // column may already exist
  }
  try {
    db.exec('ALTER TABLE slack_messages ADD COLUMN attachments_json TEXT');
  } catch {
    // column may already exist
  }
}

declare global {
  var initializeSlackSchema: () => void;
}
globalThis.initializeSlackSchema = initializeSchema;

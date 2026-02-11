// Shared types for Slack skill

export interface SlackConfig {
  botToken: string;
  workspaceName: string;
  syncIntervalMinutes: number;
}

export const SLACK_BASE_URL = 'https://slack.com/api';
export const SLACK_REQUEST_TIMEOUT = 15000;

/** Max channels to fetch history for per sync (avoid rate limits). */
export const SYNC_MAX_CHANNELS = 30;
/** Rolling window: always keep this many days of messages. */
export const SYNC_WINDOW_DAYS = 90;
/** Max pages per channel per sync run (each page = 200 messages). */
export const SYNC_MAX_PAGES_PER_CHANNEL = 10;

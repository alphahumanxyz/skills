// Slack API helper
import { SLACK_BASE_URL, SLACK_REQUEST_TIMEOUT } from '../types';

/**
 * Generic Slack API fetch.
 * Returns the full parsed response body as a loosely-typed record so callers
 * can access any top-level field (channels, channel, message, members, etc.).
 */
export async function slackApiFetch(
  method: string,
  endpoint: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const s = globalThis.getSlackSkillState();
  const token = s.config.botToken;
  if (!token) {
    throw new Error('Slack not connected. Please complete setup first.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SLACK_BASE_URL}${endpoint}`;
  const isGet = method.toUpperCase() === 'GET';

  let fullUrl = url;
  let body: string | undefined;

  if (isGet && params && Object.keys(params).length > 0) {
    const pairs: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
      }
    }
    fullUrl = `${url}?${pairs.join('&')}`;
  } else if (!isGet && params) {
    body = JSON.stringify(params);
  }

  const response = await net.fetch(fullUrl, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
    timeout: SLACK_REQUEST_TIMEOUT,
  });

  if (response.status === 429) {
    throw new Error('Slack rate limited. Please try again in a moment.');
  }

  const parsed = JSON.parse(await response.body) as Record<string, unknown> & {
    ok: boolean;
    error?: string;
  };
  if (!parsed.ok && response.status >= 400) {
    const err = parsed.error;
    throw new Error(err || `Slack API error: ${response.status}`);
  }

  return parsed;
}

export function formatApiError(error: unknown): string {
  const message = String(error);
  if (message.includes('401') || message.includes('invalid_auth')) {
    return 'Invalid or expired token. Check your Slack app settings.';
  }
  if (message.includes('429')) {
    return 'Rate limited. Please try again in a moment.';
  }
  if (message.includes('channel_not_found') || message.includes('not_in_channel')) {
    return 'Channel not found or bot is not in the channel.';
  }
  return message;
}

declare global {
  var slackApi: { slackApiFetch: typeof slackApiFetch; formatApiError: typeof formatApiError };
}
globalThis.slackApi = { slackApiFetch, formatApiError };

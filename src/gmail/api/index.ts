// ---------------------------------------------------------------------------
// Gmail API helper (uses oauth.fetch proxy)
import { getGmailSkillState } from '../state';

// ---------------------------------------------------------------------------
const GMAIL_API_PREFIX = '/gmail/v1';

export async function gmailFetch(
  endpoint: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<{ success: boolean; data?: any; error?: { code: number; message: string } }> {
  const credential = oauth.getCredential();

  if (!credential) {
    console.log('[gmail] gmailFetch: no credential (OAuth not connected)');
    return {
      success: false,
      error: { code: 401, message: 'Gmail not connected. Complete OAuth setup first.' },
    };
  }

  const path = endpoint.startsWith('/')
    ? GMAIL_API_PREFIX + endpoint
    : GMAIL_API_PREFIX + '/' + endpoint;

  try {
    const response = await oauth.fetch(endpoint, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body,
      timeout: options.timeout || 30,
    });

    const s = getGmailSkillState();

    if (response.status === 401) {
      const bodyPreview = response.body ? response.body.slice(0, 200) : '(empty)';
      console.log(
        `[gmail] gmailFetch: 401 Unauthorized path=${path} credentialId=${credential.credentialId} body=${bodyPreview}`
      );
    } else if (response.status >= 400) {
      const bodyPreview = response.body ? response.body.slice(0, 200) : '(empty)';
      console.log(
        `[gmail] gmailFetch: error path=${path} status=${response.status} body=${bodyPreview}`
      );
    }

    // Update rate limit info from headers
    if (response.headers['x-ratelimit-remaining']) {
      s.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
    }
    if (response.headers['x-ratelimit-reset']) {
      s.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'], 10) * 1000;
    }

    if (response.status >= 200 && response.status < 300) {
      const data = response.body ? JSON.parse(response.body) : null;
      s.lastApiError = null;
      return { success: true, data };
    } else {
      const error = response.body
        ? JSON.parse(response.body)
        : { code: response.status, message: 'API request failed' };
      s.lastApiError = error.message || `HTTP ${response.status}`;
      return { success: false, error };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const s = getGmailSkillState();
    s.lastApiError = errorMsg;
    return { success: false, error: { code: 500, message: errorMsg } };
  }
}

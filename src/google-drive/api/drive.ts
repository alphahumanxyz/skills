// API helper for Google Drive, Sheets, and Docs

export async function driveFetch(
  endpoint: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
    baseUrl?: string;
  } = {}
): Promise<{ success: boolean; data?: unknown; error?: { code: number; message: string } }> {
  if (!oauth.getCredential()) {
    return {
      success: false,
      error: { code: 401, message: 'Google Drive not connected. Complete OAuth setup first.' },
    };
  }

  try {
    const response = await oauth.fetch(endpoint, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body,
      timeout: options.timeout || 30,
      baseUrl: options.baseUrl,
    });

    const s = globalThis.getGoogleDriveSkillState();
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
    }
    const error = response.body
      ? JSON.parse(response.body)
      : { code: response.status, message: 'API request failed' };
    s.lastApiError = (error as { message?: string }).message || `HTTP ${response.status}`;
    return { success: false, error: { code: response.status, message: s.lastApiError } };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const s = globalThis.getGoogleDriveSkillState();
    s.lastApiError = errorMsg;
    return { success: false, error: { code: 500, message: errorMsg } };
  }
}

declare global {
  var googleDriveApi: { driveFetch: typeof driveFetch };
}
globalThis.googleDriveApi = { driveFetch };

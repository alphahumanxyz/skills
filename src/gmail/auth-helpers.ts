// OAuth2 authentication helpers for Gmail skill
// Handles token management, refresh, and API authentication

import './skill-state';
import type { OAuth2Token, OAuth2Config, ApiError, SkillConfig } from './types';

const GOOGLE_OAUTH_BASE_URL = 'https://oauth2.googleapis.com';
const GOOGLE_TOKEN_URL = `${GOOGLE_OAUTH_BASE_URL}/token`;
const GOOGLE_REVOKE_URL = `${GOOGLE_OAUTH_BASE_URL}/revoke`;
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

/**
 * Generate OAuth2 authorization URL for user consent
 */
export function generateAuthUrl(config: OAuth2Config): string {
  const params = [
    `client_id=${encodeURIComponent(config.clientId)}`,
    `redirect_uri=${encodeURIComponent(config.redirectUri)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(config.scope)}`,
    `access_type=offline`,
    `prompt=consent`
  ];

  return `${GOOGLE_OAUTH_BASE_URL}/auth?${params.join('&')}`;
}

/**
 * Exchange authorization code for OAuth2 tokens
 */
export function exchangeCodeForTokens(
  code: string,
  config: OAuth2Config
): OAuth2Token | null {
  try {
    const response = net.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: [
        `client_id=${encodeURIComponent(config.clientId)}`,
        `client_secret=${encodeURIComponent(config.clientSecret)}`,
        `code=${encodeURIComponent(code)}`,
        `grant_type=authorization_code`,
        `redirect_uri=${encodeURIComponent(config.redirectUri)}`
      ].join('&'),
      timeout: 10000,
    });

    if (response.status !== 200) {
      console.error(`[gmail] Token exchange failed: ${response.status} ${response.body}`);
      return null;
    }

    const token = JSON.parse(response.body) as OAuth2Token;
    return token;
  } catch (error) {
    console.error(`[gmail] Token exchange error: ${error}`);
    return null;
  }
}

/**
 * Refresh OAuth2 access token using refresh token
 */
export function refreshAccessToken(refreshToken: string, config: OAuth2Config): OAuth2Token | null {
  try {
    const response = net.fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: [
        `client_id=${encodeURIComponent(config.clientId)}`,
        `client_secret=${encodeURIComponent(config.clientSecret)}`,
        `refresh_token=${encodeURIComponent(refreshToken)}`,
        `grant_type=refresh_token`
      ].join('&'),
      timeout: 10000,
    });

    if (response.status !== 200) {
      console.error(`[gmail] Token refresh failed: ${response.status} ${response.body}`);
      return null;
    }

    const token = JSON.parse(response.body) as OAuth2Token;
    return token;
  } catch (error) {
    console.error(`[gmail] Token refresh error: ${error}`);
    return null;
  }
}

/**
 * Revoke OAuth2 token
 */
export function revokeToken(token: string): boolean {
  try {
    const response = net.fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
      timeout: 10000,
    });

    return response.status === 200;
  } catch (error) {
    console.error(`[gmail] Token revocation error: ${error}`);
    return false;
  }
}

/**
 * Check if access token is expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(tokenExpiry: number): boolean {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return now >= (tokenExpiry - fiveMinutes);
}

/**
 * Ensure we have a valid access token, refreshing if necessary
 */
export function ensureValidToken(): boolean {
  const s = globalThis.getGmailSkillState();

  if (!s.config.refreshToken) {
    console.error('[gmail] No refresh token available');
    return false;
  }

  if (!s.config.accessToken || isTokenExpired(s.config.tokenExpiry)) {
    console.log('[gmail] Access token expired, refreshing...');

    const oauthConfig: OAuth2Config = {
      clientId: s.config.clientId,
      clientSecret: s.config.clientSecret,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
      scope: GMAIL_SCOPES.join(' '),
    };

    const token = refreshAccessToken(s.config.refreshToken, oauthConfig);
    if (!token) {
      console.error('[gmail] Failed to refresh access token');
      s.config.isAuthenticated = false;
      return false;
    }

    s.config.accessToken = token.access_token;
    s.config.tokenExpiry = Date.now() + (token.expires_in * 1000);

    // Update refresh token if provided (some providers rotate refresh tokens)
    if (token.refresh_token) {
      s.config.refreshToken = token.refresh_token;
    }

    // Persist updated tokens
    store.set('config', s.config);
    console.log('[gmail] Access token refreshed successfully');
  }

  return true;
}

/**
 * Make authenticated API request to Gmail API
 */
export function makeApiRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): { success: boolean; data?: unknown; error?: ApiError } {
  if (!ensureValidToken()) {
    return {
      success: false,
      error: {
        code: 401,
        message: 'Authentication required',
      },
    };
  }

  const s = globalThis.getGmailSkillState();

  try {
    const url = `https://gmail.googleapis.com/gmail/v1${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${s.config.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = net.fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      timeout: options.timeout || 30000,
    });

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
      const error = response.body ? JSON.parse(response.body) as ApiError : {
        code: response.status,
        message: 'API request failed',
      };
      s.lastApiError = error.message;
      return { success: false, error };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    s.lastApiError = errorMsg;
    return {
      success: false,
      error: {
        code: 500,
        message: errorMsg,
      },
    };
  }
}

/**
 * Get the default OAuth2 scopes for Gmail
 */
export function getDefaultScopes(): string[] {
  return [...GMAIL_SCOPES];
}

/**
 * Validate OAuth2 configuration
 */
export function validateOAuth2Config(config: Partial<SkillConfig>): string[] {
  const errors: string[] = [];

  if (!config.clientId || typeof config.clientId !== 'string') {
    errors.push('Client ID is required and must be a string');
  }

  if (!config.clientSecret || typeof config.clientSecret !== 'string') {
    errors.push('Client Secret is required and must be a string');
  }

  return errors;
}

// Expose helper functions on globalThis for tools to use
const _g = globalThis as Record<string, unknown>;
_g.ensureValidToken = ensureValidToken;
_g.makeApiRequest = makeApiRequest;
_g.generateAuthUrl = generateAuthUrl;
_g.exchangeCodeForTokens = exchangeCodeForTokens;
_g.refreshAccessToken = refreshAccessToken;
_g.revokeToken = revokeToken;
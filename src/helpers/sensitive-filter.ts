/**
 * Sensitive message filter — detects password reset, OTP, 2FA, login link content.
 * Used by Gmail and Telegram skills to filter/redact sensitive messages at read time.
 */

/** Lowercase phrases that indicate sensitive content (password reset, OTP, 2FA, login links). */
const SENSITIVE_PHRASES: string[] = [
  // Password reset / change
  'password reset',
  'reset your password',
  'forgot password',
  'change your password',
  'reset password link',
  'set your password',
  'new password',
  'password change',
  'reset password request',
  'unlock your account',
  // OTP / verification codes
  'verification code',
  'one-time',
  'one time password',
  'your code is',
  'confirm your email',
  'security code',
  'confirmation code',
  'activation code',
  'pin code',
  'one-time code',
  'temporary code',
  'verification link',
  // 2FA / MFA
  'two-factor',
  '2fa',
  'two factor',
  'authenticator',
  'backup code',
  'two-step verification',
  'multi-factor',
  'mfa',
  'security key',
  'recovery code',
  // Login / magic links
  'log in to',
  'sign in with this link',
  'magic link',
  'click to sign in',
  'verify your email',
  'login link',
  'sign in link',
  'secure sign in',
  'one-time link',
  'temporary link',
  'access link',
  'secure link',
  // Account / identity
  'verify your identity',
  'unusual sign-in',
  'suspicious activity',
  'account recovery',
  'recover your account',
  // Financial / card
  'transaction verification',
  'payment verification',
  'card verification',
  'cvv',
  'card number',
  // Warnings
  'do not share',
  'never share this',
  'this code expires',
];

/**
 * Lowercase standalone words matched only as whole tokens (word boundaries).
 * Used to avoid false positives from substrings (e.g. "otp" in "desktop").
 */
const SENSITIVE_STANDALONE_WORDS: string[] = ['otp'];

/**
 * Returns true if the text appears to be sensitive (password reset, OTP, 2FA, login link, etc.).
 * Empty or missing text is treated as non-sensitive.
 * Phrase matches use substring; standalone words (e.g. "otp") require word boundaries.
 */
export function isSensitiveText(text: string): boolean {
  if (typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase();
  if (normalized.length === 0) return false;
  for (const phrase of SENSITIVE_PHRASES) {
    if (normalized.includes(phrase)) return true;
  }
  for (const word of SENSITIVE_STANDALONE_WORDS) {
    const re = new RegExp('\\b' + escapeRegex(word) + '\\b', 'i');
    if (re.test(normalized)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

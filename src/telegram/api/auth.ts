// Telegram Auth API — TDLib wrappers for authentication flow.
import type TdLibClient from '../tdlib-client';

/**
 * Send phone number for authentication.
 */
export async function setAuthenticationPhoneNumber(
  client: TdLibClient,
  phoneNumber: string
): Promise<void> {
  await client.setAuthenticationPhoneNumber(phoneNumber);
}

/**
 * Submit verification code.
 */
export async function checkAuthenticationCode(client: TdLibClient, code: string): Promise<void> {
  await client.checkAuthenticationCode(code);
}

/**
 * Submit 2FA password.
 */
export async function checkAuthenticationPassword(
  client: TdLibClient,
  password: string
): Promise<void> {
  await client.checkAuthenticationPassword(password);
}

// telegram/setup.ts
// Setup flow (onSetupStart, onSetupSubmit, onSetupCancel) for Telegram skill.
import {
  checkAuthenticationCode,
  checkAuthenticationPassword,
  setAuthenticationPhoneNumber,
} from './api/auth';
import './state';

export interface TelegramSetupDeps {
  initClient: () => Promise<void>;
  onError: (args: SkillErrorArgs) => void;
  publishState: () => void;
}

export function createSetupHandlers(deps: TelegramSetupDeps): {
  onSetupStart: () => Promise<SetupStartResult>;
  onSetupSubmit: (args: {
    stepId: string;
    values: Record<string, unknown>;
  }) => Promise<SetupSubmitResult>;
  onSetupCancel: () => Promise<void>;
} {
  const { initClient, onError, publishState } = deps;

  async function sendPhoneNumber(phoneNumber: string): Promise<void> {
    const s = globalThis.getTelegramSkillState();
    if (!s.client) throw new Error('TDLib client not initialized');
    console.log('[telegram] Sending phone number for auth...');
    s.config.phoneNumber = phoneNumber;
    s.config.pendingCode = true;
    state.set('config', s.config);
    setAuthenticationPhoneNumber(s.client, phoneNumber);
    console.log('[telegram] Phone number sent, waiting for code...');
    publishState();
  }

  async function submitCode(code: string): Promise<void> {
    const s = globalThis.getTelegramSkillState();
    if (!s.client) throw new Error('TDLib client not initialized');
    console.log('[telegram] Submitting verification code...');
    checkAuthenticationCode(s.client, code);
    console.log('[telegram] Code submitted');
  }

  async function submitPassword(password: string): Promise<void> {
    const s = globalThis.getTelegramSkillState();
    if (!s.client) throw new Error('TDLib client not initialized');
    console.log('[telegram] Submitting 2FA password...');
    checkAuthenticationPassword(s.client, password);
    console.log('[telegram] Password submitted');
  }

  async function onSetupStart(): Promise<SetupStartResult> {
    const s = globalThis.getTelegramSkillState();

    if (
      (!s.client && !s.clientConnecting) ||
      s.authState === 'closed' ||
      s.authState === 'unknown'
    ) {
      await initClient().catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError({ type: 'network', message: errorMsg, source: 'initClient', recoverable: true });
      });
    }

    // If TDLib already has auth state from a previous session, start at the right step
    if (s.authState === 'waitCode') {
      return {
        step: {
          id: 'code',
          title: 'Enter Verification Code',
          description:
            'A verification code has been sent to your Telegram app or SMS. Enter it below.',
          fields: [
            {
              name: 'code',
              type: 'text',
              label: 'Verification Code',
              description: '5-digit code from Telegram',
              required: true,
            },
          ],
        },
      };
    }

    if (s.authState === 'waitPassword') {
      return {
        step: {
          id: 'password',
          title: 'Two-Factor Authentication',
          description: s.passwordHint
            ? `Enter your 2FA password. Hint: ${s.passwordHint}`
            : 'Enter your 2FA password.',
          fields: [
            {
              name: 'password',
              type: 'password',
              label: '2FA Password',
              description: 'Your Telegram 2FA password',
              required: true,
            },
          ],
        },
      };
    }

    return {
      step: {
        id: 'phone',
        title: 'Connect Telegram Account',
        description: 'Enter your phone number to connect your Telegram account.',
        fields: [
          {
            name: 'phoneNumber',
            type: 'text',
            label: 'Phone Number',
            description: 'International format (e.g., +1234567890)',
            required: true,
            placeholder: '+1234567890',
          },
        ],
      },
    };
  }

  async function onSetupSubmit(args: {
    stepId: string;
    values: Record<string, unknown>;
  }): Promise<SetupSubmitResult> {
    const s = globalThis.getTelegramSkillState();
    const { stepId, values } = args;

    console.log('[telegram] onSetupSubmit:', JSON.stringify(args));
    console.log('[telegram] Auth state:', s.authState);

    if (stepId === 'credentials') {
      const apiId = parseInt((values.apiId as string) || '', 10);
      const apiHash = ((values.apiHash as string) || '').trim();

      console.log(
        `[telegram] Setup: credentials step - apiId: ${apiId}, apiHash: ${apiHash ? '[set]' : '[empty]'}`
      );

      await initClient().catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError({ type: 'network', message: errorMsg, source: 'initClient', recoverable: true });
      });

      return {
        status: 'next',
        nextStep: {
          id: 'phone',
          title: 'Connect Telegram Account',
          description:
            'Enter your phone number to connect your Telegram account. Please wait a moment for the connection to establish.',
          fields: [
            {
              name: 'phoneNumber',
              type: 'text',
              label: 'Phone Number',
              description: 'International format (e.g., +1234567890)',
              required: true,
              placeholder: '+1234567890',
            },
          ],
        },
      };
    }

    if (stepId === 'phone') {
      const phoneNumber = ((values.phoneNumber as string) || '').trim();

      console.log(
        `[telegram] Setup: phone step - number: ${phoneNumber ? phoneNumber.slice(0, 4) + '****' : '[empty]'}`
      );
      console.log(
        `[telegram] Setup: client connected: ${s.client !== null}, connecting: ${s.clientConnecting}, authState: ${s.authState}`
      );

      if (!phoneNumber) {
        return {
          status: 'error',
          errors: [{ field: 'phoneNumber', message: 'Phone number is required' }],
        };
      }

      if (!phoneNumber.startsWith('+')) {
        return {
          status: 'error',
          errors: [
            {
              field: 'phoneNumber',
              message: 'Phone number must start with + (international format)',
            },
          ],
        };
      }

      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return {
          status: 'error',
          errors: [
            {
              field: 'phoneNumber',
              message: 'Invalid phone number format. Use international format: +1234567890',
            },
          ],
        };
      }

      if (!s.client || s.clientConnecting) {
        if (!s.client && !s.clientConnecting) {
          await initClient().catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            onError({
              type: 'network',
              message: errorMsg,
              source: 'initClient',
              recoverable: true,
            });
          });
        }
        return {
          status: 'error',
          errors: [
            {
              field: 'phoneNumber',
              message: 'Connecting to Telegram... Please wait a moment and try again.',
            },
          ],
        };
      }

      if (s.authState === 'ready') {
        console.log('[telegram] Auth state is ready');
        return { status: 'complete' };
      }

      if (s.authState === 'waitCode') {
        // Already past phone step — skip straight to code entry
        return {
          status: 'next',
          nextStep: {
            id: 'code',
            title: 'Enter Verification Code',
            description:
              'A verification code has been sent to your Telegram app or SMS. Enter it below.',
            fields: [
              {
                name: 'code',
                type: 'text' as const,
                label: 'Verification Code',
                description: '5-digit code from Telegram',
                required: true,
              },
            ],
          },
        };
      }

      if (s.authState === 'waitPassword') {
        // Already past phone + code — skip to 2FA
        return {
          status: 'next',
          nextStep: {
            id: 'password',
            title: 'Two-Factor Authentication',
            description: s.passwordHint
              ? `Enter your 2FA password. Hint: ${s.passwordHint}`
              : 'Enter your 2FA password.',
            fields: [
              {
                name: 'password',
                type: 'password' as const,
                label: '2FA Password',
                description: 'Your Telegram 2FA password',
                required: true,
              },
            ],
          },
        };
      }

      if (s.authState !== 'waitPhoneNumber') {
        console.log(`[telegram] Auth state is '${s.authState}', expected 'waitPhoneNumber'`);
        return {
          status: 'error',
          errors: [
            {
              field: 'phoneNumber',
              message: `Telegram is not ready for login (state: ${s.authState}). Please wait a moment and try again.`,
            },
          ],
        };
      }

      const cleanPhoneNumber = phoneNumber.replace(/[\s\-()]/g, '');
      await sendPhoneNumber(cleanPhoneNumber).catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError({
          type: 'auth',
          message: errorMsg,
          source: 'setAuthenticationPhoneNumber',
          recoverable: true,
        });
      });

      return {
        status: 'next',
        nextStep: {
          id: 'code',
          title: 'Enter Verification Code',
          description:
            'A verification code has been sent to your Telegram app or SMS. Enter it below.',
          fields: [
            {
              name: 'code',
              type: 'text',
              label: 'Verification Code',
              description: '5-digit code from Telegram',
              required: true,
              placeholder: '12345',
            },
          ],
        },
      };
    }

    if (stepId === 'code') {
      const code = ((values.code as string) || '').trim();

      console.log(`[telegram] Setup: code step - authState: ${s.authState}`);

      if (!code) {
        return {
          status: 'error',
          errors: [{ field: 'code', message: 'Verification code is required' }],
        };
      }

      await submitCode(code).catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError({
          type: 'auth',
          message: errorMsg,
          source: 'checkAuthenticationCode',
          recoverable: true,
        });
      });

      if (s.authState === 'waitPassword') {
        return {
          status: 'next',
          nextStep: {
            id: 'password',
            title: 'Two-Factor Authentication',
            description: s.passwordHint
              ? `Enter your 2FA password. Hint: ${s.passwordHint}`
              : 'Enter your 2FA password.',
            fields: [
              {
                name: 'password',
                type: 'password',
                label: '2FA Password',
                description: 'Your Telegram 2FA password',
                required: true,
              },
            ],
          },
        };
      }

      return { status: 'complete' };
    }

    if (stepId === 'password') {
      const password = ((values.password as string) || '').trim();

      console.log('[telegram] Setup: password step');

      if (!password) {
        return {
          status: 'error',
          errors: [{ field: 'password', message: '2FA password is required' }],
        };
      }

      await submitPassword(password).catch(err => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError({
          type: 'auth',
          message: errorMsg,
          source: 'checkAuthenticationPassword',
          recoverable: true,
        });
      });

      return { status: 'complete' };
    }

    return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
  }

  async function onSetupCancel(): Promise<void> {
    console.log('[telegram] Setup cancelled');
    const s = globalThis.getTelegramSkillState();
    s.config.pendingCode = false;
    state.set('config', s.config);
  }

  return { onSetupStart, onSetupSubmit, onSetupCancel };
}

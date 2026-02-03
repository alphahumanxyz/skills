// Tool: telegram-sign-in
// Sign in with the verification code received after calling telegram-send-code.

declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramSignInTool: ToolDefinition = {
  name: 'telegram-sign-in',
  description:
    'Sign in with the verification code received after calling telegram-send-code. ' +
    'Returns a request ID - use telegram-get-result to check status.',
  input_schema: {
    type: 'object',
    properties: { code: { type: 'string', description: 'Verification code from Telegram' } },
    required: ['code'],
  },
  execute(args: Record<string, unknown>): string {
    const code = args.code as string;
    if (!code) {
      return JSON.stringify({ error: 'Verification code is required' });
    }
    const requestId = enqueueRequest('sign-in', { code });
    return JSON.stringify({ status: 'pending', requestId });
  },
};

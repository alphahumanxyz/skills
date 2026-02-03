// Tool: telegram-send-code
// Send a verification code to the specified phone number.

declare const enqueueRequest: (type: string, args: Record<string, unknown>) => string;

export const telegramSendCodeTool: ToolDefinition = {
  name: 'telegram-send-code',
  description:
    'Send a verification code to the specified phone number. ' +
    'Returns a request ID - use telegram-get-result to check status.',
  input_schema: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: 'Phone number in international format (e.g., +1234567890)',
      },
    },
    required: ['phone_number'],
  },
  execute(args: Record<string, unknown>): string {
    const phoneNumber = args.phone_number as string;
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return JSON.stringify({ error: 'Phone number must be in international format (+...)' });
    }
    const requestId = enqueueRequest('send-code', { phoneNumber });
    return JSON.stringify({ status: 'pending', requestId });
  },
};

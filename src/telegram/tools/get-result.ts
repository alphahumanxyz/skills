// Tool: telegram-get-result
// Get the result of an async Telegram operation by request ID.

declare const getRequest: (
  id: string
) => {
  id: string;
  type: string;
  status: string;
  result: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
} | null;

export const telegramGetResultTool: ToolDefinition = {
  name: 'telegram-get-result',
  description:
    'Get the result of an async Telegram operation by request ID. ' +
    'Returns the status and result/error of the operation.',
  input_schema: {
    type: 'object',
    properties: {
      request_id: { type: 'string', description: 'The request ID returned by an async operation' },
    },
    required: ['request_id'],
  },
  execute(args: Record<string, unknown>): string {
    const requestId = args.request_id as string;
    const request = getRequest(requestId);
    if (!request) {
      return JSON.stringify({ error: 'Request not found', requestId });
    }
    return JSON.stringify({
      requestId: request.id,
      type: request.type,
      status: request.status,
      result: request.result ? JSON.parse(request.result) : null,
      error: request.error,
      createdAt: request.created_at,
      completedAt: request.completed_at,
    });
  },
};

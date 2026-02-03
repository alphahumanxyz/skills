// Tool: ping-now
// Trigger an immediate ping to the configured server and return the result.

declare const PING_COUNT: number;
declare const db: { get: (sql: string, params: unknown[]) => unknown };
declare function doPing(): void;

export const pingNowTool: ToolDefinition = {
  name: 'ping-now',
  description: 'Trigger an immediate ping to the configured server and return the result.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    doPing();
    const latest = db.get(
      'SELECT timestamp, status, latency_ms, success, error FROM ping_log ORDER BY id DESC LIMIT 1',
      []
    );
    return JSON.stringify({ triggered: true, pingNumber: PING_COUNT, result: latest });
  },
};

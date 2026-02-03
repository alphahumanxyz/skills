// Tool: ping-now
// Trigger an immediate ping to the configured server and return the result.

// Import ensures state is initialized; getSkillState() is called as global at runtime
import '../skill-state';

// doPing is exposed on globalThis by the main skill module
declare function doPing(): void;

export const pingNowTool: ToolDefinition = {
  name: 'ping-now',
  description: 'Trigger an immediate ping to the configured server and return the result.',
  input_schema: { type: 'object', properties: {} },
  execute(): string {
    doPing();
    const s = getSkillState();
    const latest = db.get(
      'SELECT timestamp, status, latency_ms, success, error FROM ping_log ORDER BY id DESC LIMIT 1',
      []
    );
    return JSON.stringify({
      triggered: true,
      pingNumber: s.pingCount,
      result: latest,
    });
  },
};

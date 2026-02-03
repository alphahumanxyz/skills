// Tool: get-ping-stats
// Get current ping statistics including uptime, total pings, failures, and latest latency.

// These are global variables available in the V8 runtime context
declare const CONFIG: { serverUrl: string };
declare const PING_COUNT: number;
declare const FAIL_COUNT: number;
declare const CONSECUTIVE_FAILS: number;
declare const db: {
  get: (sql: string, params: unknown[]) => unknown;
};
declare const platform: {
  os: () => string;
};

export const getPingStatsTool: ToolDefinition = {
  name: "get-ping-stats",
  description:
    "Get current ping statistics including uptime, total pings, failures, and latest latency.",
  input_schema: {
    type: "object",
    properties: {},
  },
  execute(): string {
    const uptimePct =
      PING_COUNT > 0
        ? Math.round(((PING_COUNT - FAIL_COUNT) / PING_COUNT) * 10000) / 100
        : 100;
    const latest = db.get(
      "SELECT latency_ms, status, timestamp FROM ping_log ORDER BY id DESC LIMIT 1",
      [],
    ) as { latency_ms: number; status: number; timestamp: string } | null;
    const avgLatency = db.get(
      "SELECT AVG(latency_ms) as avg_ms FROM ping_log WHERE success = 1",
      [],
    ) as { avg_ms: number | null } | null;
    return JSON.stringify({
      serverUrl: CONFIG.serverUrl,
      totalPings: PING_COUNT,
      totalFailures: FAIL_COUNT,
      consecutiveFailures: CONSECUTIVE_FAILS,
      uptimePercent: uptimePct,
      lastPing: latest
        ? { latencyMs: latest.latency_ms, status: latest.status, at: latest.timestamp }
        : null,
      avgLatencyMs: avgLatency?.avg_ms ? Math.round(avgLatency.avg_ms) : null,
      platform: platform.os(),
    });
  },
};

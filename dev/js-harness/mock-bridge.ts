// mock-bridge.ts — Mock implementations of all Rust-provided bridge globals.
// These are the raw __-prefixed objects that the helper layer wraps.
// Loaded after mock-sql.ts so __sqlExec/__sqlGet/__sqlAll are available.

// ---------------------------------------------------------------------------
// Shared mock state (accessible from tests)
// ---------------------------------------------------------------------------

(globalThis as any).__mockConsoleLogs = [] as { level: string; args: unknown[] }[];
(globalThis as any).__mockStore = {} as Record<string, string>; // JSON string values
(globalThis as any).__mockCronSchedules = {} as Record<string, string>;
(globalThis as any).__mockFetchResponses = {} as Record<
  string,
  { status: number; headers: Record<string, string>; body: string }
>;
(globalThis as any).__mockFetchCalls = [] as { url: string; options: string }[];
(globalThis as any).__mockNotifications = [] as { title: string; body: string }[];
(globalThis as any).__mockDataFiles = {} as Record<string, string>;
(globalThis as any).__mockPlatformOs = "macos";
(globalThis as any).__mockPlatformEnv = {} as Record<string, string>;
(globalThis as any).__mockSkillsList = [] as { id: string; name: string; version: string; status: string }[];
(globalThis as any).__mockSkillTools = {} as Record<string, (args: string) => string>;

// ---------------------------------------------------------------------------
// console mock
// ---------------------------------------------------------------------------

const _std = (globalThis as any)._std;

(globalThis as any).console = {
  log(...args: unknown[]): void {
    (globalThis as any).__mockConsoleLogs.push({ level: "log", args });
    if (_std) _std.out.printf("[LOG] %s\n", args.map(String).join(" "));
  },
  warn(...args: unknown[]): void {
    (globalThis as any).__mockConsoleLogs.push({ level: "warn", args });
    if (_std) _std.out.printf("[WARN] %s\n", args.map(String).join(" "));
  },
  error(...args: unknown[]): void {
    (globalThis as any).__mockConsoleLogs.push({ level: "error", args });
    if (_std) _std.err.printf("[ERROR] %s\n", args.map(String).join(" "));
  },
};

// ---------------------------------------------------------------------------
// __db — backed by mock-sql engine
// ---------------------------------------------------------------------------

(globalThis as any).__db = {
  exec(sql: string, paramsJson?: string): void {
    const params = paramsJson ? JSON.parse(paramsJson) : [];
    (globalThis as any).__sqlExec(sql, params);
  },
  get(sql: string, paramsJson?: string): string {
    const params = paramsJson ? JSON.parse(paramsJson) : [];
    const result = (globalThis as any).__sqlGet(sql, params);
    return JSON.stringify(result);
  },
  all(sql: string, paramsJson?: string): string {
    const params = paramsJson ? JSON.parse(paramsJson) : [];
    const result = (globalThis as any).__sqlAll(sql, params);
    return JSON.stringify(result);
  },
  kvGet(key: string): string {
    // KV table backed by __mockStore with a "kv:" prefix
    const val = (globalThis as any).__mockStore["kv:" + key];
    return val !== undefined ? val : "null";
  },
  kvSet(key: string, valueJson: string): void {
    (globalThis as any).__mockStore["kv:" + key] = valueJson;
  },
};

// ---------------------------------------------------------------------------
// __store — in-memory key-value store (JSON string values)
// ---------------------------------------------------------------------------

(globalThis as any).__store = {
  get(key: string): string {
    const val = (globalThis as any).__mockStore[key];
    return val !== undefined ? val : "null";
  },
  set(key: string, valueJson: string): void {
    (globalThis as any).__mockStore[key] = valueJson;
  },
  delete(key: string): void {
    delete (globalThis as any).__mockStore[key];
  },
  keys(): string {
    const keys = Object.keys((globalThis as any).__mockStore).filter(
      (k) => !k.startsWith("kv:") && !k.startsWith("__state__:"),
    );
    return JSON.stringify(keys);
  },
};

// ---------------------------------------------------------------------------
// __net — configurable fetch responses
// ---------------------------------------------------------------------------

(globalThis as any).__net = {
  fetch(url: string, optionsJson: string): string {
    (globalThis as any).__mockFetchCalls.push({ url, options: optionsJson });

    const responses = (globalThis as any).__mockFetchResponses as Record<
      string,
      { status: number; headers: Record<string, string>; body: string }
    >;

    // Check for exact URL match first, then wildcard "*"
    const response = responses[url] || responses["*"];
    if (response) {
      return JSON.stringify(response);
    }

    // Default: 200 OK
    return JSON.stringify({
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
    });
  },
};

// ---------------------------------------------------------------------------
// __cron — in-memory schedule registry
// ---------------------------------------------------------------------------

(globalThis as any).__cron = {
  register(scheduleId: string, cronExpr: string): void {
    (globalThis as any).__mockCronSchedules[scheduleId] = cronExpr;
  },
  unregister(scheduleId: string): void {
    delete (globalThis as any).__mockCronSchedules[scheduleId];
  },
  list(): string {
    return JSON.stringify(Object.keys((globalThis as any).__mockCronSchedules));
  },
};

// ---------------------------------------------------------------------------
// __skills — configurable peer skills list
// ---------------------------------------------------------------------------

(globalThis as any).__skills = {
  list(): string {
    return JSON.stringify((globalThis as any).__mockSkillsList);
  },
  callTool(skillId: string, toolName: string, argsJson: string): string {
    const handler = (globalThis as any).__mockSkillTools[
      `${skillId}:${toolName}`
    ];
    if (handler) {
      return handler(argsJson);
    }
    return JSON.stringify({ error: `Tool ${skillId}:${toolName} not found` });
  },
};

// ---------------------------------------------------------------------------
// __platform — OS, env, and notifications
// ---------------------------------------------------------------------------

(globalThis as any).__platform = {
  os(): string {
    return (globalThis as any).__mockPlatformOs;
  },
  env(key: string): string {
    return (globalThis as any).__mockPlatformEnv[key] || "";
  },
  notify(title: string, body: string): void {
    (globalThis as any).__mockNotifications.push({ title, body: body || "" });
  },
};

// ---------------------------------------------------------------------------
// __state — shares backing store with __store using "__state__:" key prefix
// ---------------------------------------------------------------------------

(globalThis as any).__state = {
  get(key: string): string {
    const val = (globalThis as any).__mockStore["__state__:" + key];
    return val !== undefined ? val : "null";
  },
  set(key: string, valueJson: string): void {
    (globalThis as any).__mockStore["__state__:" + key] = valueJson;
  },
  setPartial(partialJson: string): void {
    const partial = JSON.parse(partialJson);
    for (const [key, value] of Object.entries(partial)) {
      (globalThis as any).__mockStore["__state__:" + key] =
        JSON.stringify(value);
    }
  },
};

// ---------------------------------------------------------------------------
// __data — in-memory file map
// ---------------------------------------------------------------------------

(globalThis as any).__data = {
  read(filename: string): string | null {
    const val = (globalThis as any).__mockDataFiles[filename];
    return val !== undefined ? val : null;
  },
  write(filename: string, content: string): void {
    (globalThis as any).__mockDataFiles[filename] = content;
  },
};

// ---------------------------------------------------------------------------
// Reset all mocks (called between test suites)
// ---------------------------------------------------------------------------

(globalThis as any).__resetAllMocks = function (): void {
  (globalThis as any).__mockConsoleLogs = [];
  (globalThis as any).__mockStore = {};
  (globalThis as any).__mockCronSchedules = {};
  (globalThis as any).__mockFetchResponses = {};
  (globalThis as any).__mockFetchCalls = [];
  (globalThis as any).__mockNotifications = [];
  (globalThis as any).__mockDataFiles = {};
  (globalThis as any).__mockPlatformOs = "macos";
  (globalThis as any).__mockPlatformEnv = {};
  (globalThis as any).__mockSkillsList = [];
  (globalThis as any).__mockSkillTools = {};
  (globalThis as any).__sqlResetTables();
  // Note: tools is NOT reset here — the skill assigns it once at load time.
  // Skill module-level state (CONFIG, counters, etc.) must be reset by
  // calling init() after setting up the store/env in each test.
};

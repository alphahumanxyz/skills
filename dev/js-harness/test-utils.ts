// test-utils.ts — Shared test helpers for QuickJS skill tests.

interface SetupSkillTestOptions {
  platformOs?: string;
  env?: Record<string, string>;
  storeData?: Record<string, unknown>;
  fetchResponses?: Record<
    string,
    { status: number; headers?: Record<string, string>; body: string }
  >;
  peerSkills?: { id: string; name: string; version?: string; status?: string }[];
  dataFiles?: Record<string, string>;
}

/** Reset all mocks and optionally pre-configure state. */
function setupSkillTest(options?: SetupSkillTestOptions): void {
  (globalThis as any).__resetAllMocks();

  if (options?.platformOs) {
    (globalThis as any).__mockPlatformOs = options.platformOs;
  }
  if (options?.env) {
    (globalThis as any).__mockPlatformEnv = { ...options.env };
  }
  if (options?.storeData) {
    for (const [key, value] of Object.entries(options.storeData)) {
      (globalThis as any).__mockStore[key] = JSON.stringify(value);
    }
  }
  if (options?.fetchResponses) {
    for (const [url, resp] of Object.entries(options.fetchResponses)) {
      (globalThis as any).__mockFetchResponses[url] = {
        status: resp.status,
        headers: resp.headers || { "content-type": "application/json" },
        body: resp.body,
      };
    }
  }
  if (options?.peerSkills) {
    (globalThis as any).__mockSkillsList = options.peerSkills.map((s) => ({
      id: s.id,
      name: s.name,
      version: s.version || "1.0.0",
      status: s.status || "running",
    }));
  }
  if (options?.dataFiles) {
    (globalThis as any).__mockDataFiles = { ...options.dataFiles };
  }
}

/** Find a tool by name in globalThis.tools and call its execute function. */
function callTool(
  toolName: string,
  args?: Record<string, unknown>,
): unknown {
  const toolsList = (globalThis as any).tools as Array<{
    name: string;
    execute: (args: Record<string, unknown>) => string;
  }>;
  const tool = toolsList.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found. Available: ${toolsList.map((t) => t.name).join(", ")}`);
  }
  const result = tool.execute(args || {});
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

/** Get a snapshot of all mock internals for assertions. */
function getMockState(): {
  consoleLogs: { level: string; args: unknown[] }[];
  store: Record<string, string>;
  cronSchedules: Record<string, string>;
  fetchCalls: { url: string; options: string }[];
  notifications: { title: string; body: string }[];
  dataFiles: Record<string, string>;
  stateValues: Record<string, unknown>;
} {
  const storeRaw = (globalThis as any).__mockStore as Record<string, string>;
  const stateValues: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(storeRaw)) {
    if (key.startsWith("__state__:")) {
      const stateKey = key.replace("__state__:", "");
      try {
        stateValues[stateKey] = JSON.parse(val);
      } catch {
        stateValues[stateKey] = val;
      }
    }
  }

  return {
    consoleLogs: (globalThis as any).__mockConsoleLogs,
    store: storeRaw,
    cronSchedules: (globalThis as any).__mockCronSchedules,
    fetchCalls: (globalThis as any).__mockFetchCalls,
    notifications: (globalThis as any).__mockNotifications,
    dataFiles: (globalThis as any).__mockDataFiles,
    stateValues,
  };
}

/** Configure mock fetch to return a specific response for a URL. */
function mockFetchResponse(
  url: string,
  status: number,
  body: string,
  headers?: Record<string, string>,
): void {
  (globalThis as any).__mockFetchResponses[url] = {
    status,
    headers: headers || { "content-type": "application/json" },
    body,
  };
}

/** Configure a mock fetch that throws (simulating network error). */
function mockFetchError(url: string, message?: string): void {
  (globalThis as any).__mockFetchErrors[url] = message || "Network error: connection refused";
}

// Expose to global scope
(globalThis as any).setupSkillTest = setupSkillTest;
(globalThis as any).callTool = callTool;
(globalThis as any).getMockState = getMockState;
(globalThis as any).mockFetchResponse = mockFetchResponse;
(globalThis as any).mockFetchError = mockFetchError;

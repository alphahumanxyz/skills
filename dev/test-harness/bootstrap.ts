/**
 * bootstrap.ts - Provides the same globals as Rust's bootstrap.js
 *
 * Creates all the bridge APIs (db, store, net, platform, state, data, cron, skills)
 * with mock implementations backed by mock-state.ts.
 */

import { dbAll, dbExec, dbGet, dbKvGet, dbKvSet } from './mock-db.ts';
import { getMockState, type FetchOptions } from './mock-state.ts';

/**
 * Create all bridge API globals and inject them into the provided context
 */
export function createBridgeAPIs(): Record<string, unknown> {
  const state = getMockState();

  // Console - logs to mock state for inspection
  const console = {
    log: (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      state.consoleOutput.push({ level: 'log', message });
      // Also print to real console for visibility during script execution
      globalThis.console.log('[skill]', ...args);
    },
    info: (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      state.consoleOutput.push({ level: 'info', message });
      globalThis.console.info('[skill]', ...args);
    },
    warn: (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      state.consoleOutput.push({ level: 'warn', message });
      globalThis.console.warn('[skill]', ...args);
    },
    error: (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      state.consoleOutput.push({ level: 'error', message });
      globalThis.console.error('[skill]', ...args);
    },
    debug: (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      state.consoleOutput.push({ level: 'debug', message });
      globalThis.console.debug('[skill]', ...args);
    },
  };

  // Store API - persistent key-value store
  const store = {
    get: (key: string): unknown => {
      return state.store[key] ?? null;
    },
    set: (key: string, value: unknown): void => {
      state.store[key] = value;
    },
    delete: (key: string): void => {
      delete state.store[key];
    },
    keys: (): string[] => {
      return Object.keys(state.store);
    },
  };

  // Database API - SQLite mock
  const db = {
    exec: (sql: string, params?: unknown[]): void => {
      dbExec(sql, params ?? []);
    },
    get: (sql: string, params?: unknown[]): Record<string, unknown> | null => {
      return dbGet(sql, params ?? []);
    },
    all: (sql: string, params?: unknown[]): Array<Record<string, unknown>> => {
      return dbAll(sql, params ?? []);
    },
    kvGet: (key: string): unknown => {
      return dbKvGet(key);
    },
    kvSet: (key: string, value: unknown): void => {
      dbKvSet(key, value);
    },
  };

  // Network API - HTTP mock
  const net = {
    fetch: (url: string, options?: FetchOptions): { status: number; headers: Record<string, string>; body: string } => {
      // Record the fetch call
      state.fetchCalls.push({ url, options });

      // Check for mock error
      if (state.fetchErrors[url]) {
        throw new Error(state.fetchErrors[url]);
      }

      // Check for mock response
      const mockResponse = state.fetchResponses[url];
      if (mockResponse) {
        return {
          status: mockResponse.status,
          headers: mockResponse.headers ?? {},
          body: mockResponse.body,
        };
      }

      // Default: return 404
      return {
        status: 404,
        headers: {},
        body: JSON.stringify({ error: 'Not found (no mock configured)' }),
      };
    },
  };

  // Platform API
  const platform = {
    os: (): string => {
      return state.platformOs;
    },
    env: (key: string): string => {
      return state.env[key] ?? '';
    },
    notify: (title: string, body?: string): void => {
      state.notifications.push({ title, body });
      globalThis.console.log(`[notification] ${title}${body ? ': ' + body : ''}`);
    },
  };

  // State API - frontend state publishing
  const stateApi = {
    get: (key: string): unknown => {
      return state.state[key];
    },
    set: (key: string, value: unknown): void => {
      state.state[key] = value;
    },
    setPartial: (partial: Record<string, unknown>): void => {
      Object.assign(state.state, partial);
    },
  };

  // Data API - file I/O mock
  const data = {
    read: (filename: string): string | null => {
      return state.dataFiles[filename] ?? null;
    },
    write: (filename: string, content: string): void => {
      state.dataFiles[filename] = content;
    },
  };

  // Cron API
  const cron = {
    register: (scheduleId: string, cronExpr: string): void => {
      state.cronSchedules[scheduleId] = cronExpr;
    },
    unregister: (scheduleId: string): void => {
      delete state.cronSchedules[scheduleId];
    },
    list: (): string[] => {
      return Object.keys(state.cronSchedules);
    },
  };

  // Skills API - inter-skill communication
  const skills = {
    list: () => {
      return state.peerSkills;
    },
    callTool: (_skillId: string, _toolName: string, _args?: Record<string, unknown>): unknown => {
      // Mock: would require loading other skills
      return { error: 'Inter-skill calls not supported in test harness' };
    },
  };

  // Timer mocks
  const setTimeout = (callback: () => void, delay = 0): number => {
    const id = state.nextTimerId++;
    state.timers.set(id, {
      callback,
      delay,
      isInterval: false,
      scheduledAt: Date.now(),
    });
    return id;
  };

  const setInterval = (callback: () => void, delay = 0): number => {
    const id = state.nextTimerId++;
    state.timers.set(id, {
      callback,
      delay,
      isInterval: true,
      scheduledAt: Date.now(),
    });
    return id;
  };

  const clearTimeout = (id: number): void => {
    state.timers.delete(id);
  };

  const clearInterval = (id: number): void => {
    state.timers.delete(id);
  };

  return {
    console,
    store,
    db,
    net,
    platform,
    state: stateApi,
    data,
    cron,
    skills,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    // JavaScript globals
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    Error,
    TypeError,
    ReferenceError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    RegExp,
    Symbol,
    BigInt,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    DataView,
    TextEncoder,
    TextDecoder,
    // Base64
    btoa: (str: string): string => btoa(str),
    atob: (str: string): string => atob(str),
    // Pre-declare skill globals
    tools: [],
    init: undefined,
    start: undefined,
    stop: undefined,
    onCronTrigger: undefined,
    onSessionStart: undefined,
    onSessionEnd: undefined,
    onSetupStart: undefined,
    onSetupSubmit: undefined,
    onSetupCancel: undefined,
    onDisconnect: undefined,
    onListOptions: undefined,
    onSetOption: undefined,
  };
}

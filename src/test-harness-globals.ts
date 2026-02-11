/**
 * Shared test harness globals. The V8/harness runner injects describe, it, assert*,
 * setupSkillTest, callTool, getMockState, mockFetchResponse, mockFetchError onto
 * globalThis before loading test files. This module centralizes typed access so
 * multiple test files do not redeclare the same identifiers.
 */
const g = globalThis as Record<string, unknown>;

export const _describe = g.describe as (name: string, fn: () => void) => void;
export const _it = g.it as (name: string, fn: () => void) => void;
export const _assert = g.assert as (cond: unknown, msg?: string) => void;
export const _assertEqual = g.assertEqual as (a: unknown, b: unknown, msg?: string) => void;
export const _assertNotNull = g.assertNotNull as (v: unknown, msg?: string) => void;
export const _assertContains = g.assertContains as (h: string, n: string, msg?: string) => void;
export const _assertTrue = g.assertTrue as (v: unknown, msg?: string) => void;
export const _assertNull = g.assertNull as (v: unknown, msg?: string) => void;
export const _assertFalse = g.assertFalse as (v: unknown, msg?: string) => void;
export const _assertGreaterThan = g.assertGreaterThan as (
  a: number,
  b: number,
  msg?: string
) => void;

export interface SetupSkillTestOptions {
  stateData?: Record<string, unknown>;
  fetchResponses?: Record<
    string,
    { status: number; headers?: Record<string, string>; body: string }
  >;
  fetchErrors?: Record<string, string>;
  oauthAvailable?: boolean;
  oauthCredentials?: Record<string, unknown> | null;
  env?: Record<string, string>;
  platformOs?: string;
  counters?: Record<string, unknown>;
  peerSkills?: { id: string; name: string; version?: string; status?: string }[];
}

export const _setup = g.setupSkillTest as (opts?: SetupSkillTestOptions) => void;
export const _callTool = g.callTool as (name: string, args?: Record<string, unknown>) => unknown;
/** Return type is intentionally loose so tests can access mock state without casting every property. */
export const _getMockState = g.getMockState as () => Record<string, unknown> & {
  cronSchedules?: Record<string, string>;
  state?: Record<string, unknown>;
  store?: Record<string, unknown>;
  dataFiles?: Record<string, string>;
  notifications?: unknown[];
  stateValues?: Record<string, unknown>;
};
export const _mockFetchResponse = g.mockFetchResponse as (
  url: string,
  status: number,
  body: string,
  headers?: Record<string, string>
) => void;
export const _mockFetchError = g.mockFetchError as (url: string, message?: string) => void;

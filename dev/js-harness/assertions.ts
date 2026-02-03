// assertions.ts — Minimal test framework for QuickJS skill tests.
// Provides describe/it structure with colored output.

(globalThis as any).__testPassCount = 0;
(globalThis as any).__testFailCount = 0;
(globalThis as any).__testCurrentDescribe = "";

const _stdOut = (globalThis as any)._std
  ? (globalThis as any)._std.out
  : null;
const _stdErr = (globalThis as any)._std
  ? (globalThis as any)._std.err
  : null;

function __testPrint(msg: string): void {
  if (_stdOut) _stdOut.printf("%s\n", msg);
}

function __testPrintErr(msg: string): void {
  if (_stdErr) _stdErr.printf("%s\n", msg);
}

// ---------------------------------------------------------------------------
// describe / it
// ---------------------------------------------------------------------------

function describe(name: string, fn: () => void): void {
  (globalThis as any).__testCurrentDescribe = name;
  __testPrint(`\n\x1b[1;36m  ${name}\x1b[0m`);
  fn();
}

function it(name: string, fn: () => void): void {
  try {
    fn();
    (globalThis as any).__testPassCount++;
    __testPrint(`    \x1b[32m\u2713\x1b[0m ${name}`);
  } catch (e: unknown) {
    (globalThis as any).__testFailCount++;
    const msg = e instanceof Error ? e.message : String(e);
    __testPrint(`    \x1b[31m\u2717\x1b[0m ${name}`);
    __testPrintErr(`      \x1b[31m${msg}\x1b[0m`);
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assert(condition: unknown, message?: string): void {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEqual(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected ${expectedStr}, got ${actualStr}`,
    );
  }
}

function assertNotEqual(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected value to differ from ${expectedStr}`,
    );
  }
}

function assertThrows(fn: () => void, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || "Expected function to throw");
  }
}

function assertContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected "${haystack}" to contain "${needle}"`,
    );
  }
}

function assertNull(value: unknown, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected null/undefined, got ${JSON.stringify(value)}`,
    );
  }
}

function assertNotNull(value: unknown, message?: string): void {
  if (value === null || value === undefined) {
    throw new Error(
      (message ? message + ": " : "") + "Expected non-null value",
    );
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (!(actual > expected)) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected ${actual} > ${expected}`,
    );
  }
}

function assertLessThan(actual: number, expected: number, message?: string): void {
  if (!(actual < expected)) {
    throw new Error(
      (message ? message + ": " : "") +
        `Expected ${actual} < ${expected}`,
    );
  }
}

// Expose to global scope
(globalThis as any).describe = describe;
(globalThis as any).it = it;
(globalThis as any).assert = assert;
(globalThis as any).assertEqual = assertEqual;
(globalThis as any).assertNotEqual = assertNotEqual;
(globalThis as any).assertThrows = assertThrows;
(globalThis as any).assertContains = assertContains;
(globalThis as any).assertNull = assertNull;
(globalThis as any).assertNotNull = assertNotNull;
(globalThis as any).assertGreaterThan = assertGreaterThan;
(globalThis as any).assertLessThan = assertLessThan;

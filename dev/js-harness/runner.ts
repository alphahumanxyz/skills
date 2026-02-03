// runner.ts — QuickJS test runner entry point.
// This is the only ES module file; everything else is loaded via loadScript().
// Usage: qjs --module dev/js-harness/runner.js <test-file.js>

import * as std from "std";
import * as os from "os";

// Make std available to scripts loaded via loadScript()
(globalThis as any)._std = std;

// Get test file from command-line args
// QuickJS scriptArgs[0] is the runner script itself; the test file is scriptArgs[1]
const args = (globalThis as any).scriptArgs as string[] | undefined;
const testFile = args && args.length > 1 ? args[1] : null;

if (!testFile) {
  std.err.printf("Usage: qjs --module dev/js-harness/runner.js <test-file.js>\n");
  std.exit(1);
}

// Resolve skill source from test file path.
// Convention: src/<name>/__tests__/test-*.js → src/<name>/index.js
function resolveSkillSource(testPath: string): string | null {
  const match = testPath.match(/^(src\/[^/]+)\/__tests__\//);
  if (!match) return null;
  return match[1] + "/index.js";
}

const skillSource = resolveSkillSource(testFile);

// Load harness scripts in order
std.out.printf("\x1b[1;34m\n  QuickJS Skill Test Runner\x1b[0m\n");
std.out.printf("  ========================\n");

const harnessFiles = [
  "dev/js-harness/mock-sql.js",
  "dev/js-harness/mock-bridge.js",
  "dev/js-harness/helper-layer.js",
  "dev/js-harness/assertions.js",
  "dev/js-harness/test-utils.js",
];

for (const file of harnessFiles) {
  try {
    std.loadScript(file);
  } catch (e) {
    std.err.printf("\x1b[31m  Failed to load harness: %s\x1b[0m\n", file);
    std.err.printf("  %s\n", String(e));
    std.exit(1);
  }
}

// Load skill source
if (skillSource) {
  std.out.printf("  Skill: \x1b[33m%s\x1b[0m\n", skillSource);
  try {
    std.loadScript(skillSource);
  } catch (e) {
    std.err.printf("\x1b[31m  Failed to load skill: %s\x1b[0m\n", skillSource);
    std.err.printf("  %s\n", String(e));
    std.exit(1);
  }
} else {
  std.out.printf("  \x1b[33mNo skill source detected (standalone test)\x1b[0m\n");
}

// Load and run test file
std.out.printf("  Tests: \x1b[33m%s\x1b[0m\n", testFile);
try {
  std.loadScript(testFile);
} catch (e) {
  std.err.printf("\x1b[31m  Failed to load test: %s\x1b[0m\n", testFile);
  std.err.printf("  %s\n", String(e));
  std.exit(1);
}

// Print summary
const passCount = (globalThis as any).__testPassCount as number;
const failCount = (globalThis as any).__testFailCount as number;
const total = passCount + failCount;

std.out.printf("\n  ────────────────────────\n");
if (failCount === 0) {
  std.out.printf(
    "  \x1b[32m%d/%d tests passed \u2713\x1b[0m\n\n",
    passCount,
    total,
  );
  std.exit(0);
} else {
  std.out.printf(
    "  \x1b[31m%d/%d tests failed \u2717\x1b[0m\n\n",
    failCount,
    total,
  );
  std.exit(1);
}

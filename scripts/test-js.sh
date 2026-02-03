#!/usr/bin/env bash
# test-js.sh — Compile TypeScript and run QuickJS skill tests.
# Usage:
#   ./scripts/test-js.sh                                    # run all tests
#   ./scripts/test-js.sh src/server-ping/__tests__/test-server-ping.ts  # run one

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── Check prerequisites ─────────────────────────────────────────────────────

if ! command -v qjs &>/dev/null; then
  echo "Error: qjs (QuickJS) not found. Install with: brew install quickjs"
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "Error: npx not found. Install Node.js first."
  exit 1
fi

# ── Compile TypeScript ───────────────────────────────────────────────────────

echo "Compiling skill sources and test harness..."

# Compile skills and harness using tsconfig.test.json (excludes test files)
npx tsc -p tsconfig.test.json

# Compile each test file individually to avoid duplicate definition conflicts
echo "Compiling test files..."
for ts_file in $(find src -path '*/__tests__/test-*.ts' 2>/dev/null); do
  npx tsc \
    --target ES2020 \
    --module ES2020 \
    --moduleResolution node \
    --outDir . \
    --rootDir . \
    --skipLibCheck \
    --declaration false \
    --esModuleInterop \
    types/globals.d.ts \
    types/quickjs.d.ts \
    "$ts_file" 2>/dev/null || echo "  Warning: Compilation issues in $ts_file (continuing anyway)"
done

# Post-process compiled JS for QuickJS script mode compatibility.
# 1. Strip "export {};" — loadScript() is script mode, not ES module.
# 2. Convert top-level let/const to var — so declarations become globalThis
#    properties, enabling test reset between test cases.
# The runner.js is an ES module and excluded from these transforms.
# Use a for-loop to avoid sed regex escaping issues with find -exec {} +
for js_file in $(find src dev/js-harness -name '*.js' -not -name 'runner.js'); do
  sed -i '' -e '/^export {};$/d' -e 's/^let /var /g' -e 's/^const /var /g' "$js_file"
done

echo "Compilation complete."

# ── Discover test files ──────────────────────────────────────────────────────

TEST_FILES=()

if [ $# -gt 0 ]; then
  # Use provided arguments (convert .ts to .js if needed)
  for arg in "$@"; do
    js_file="${arg%.ts}.js"
    if [ ! -f "$js_file" ]; then
      echo "Error: Compiled test file not found: $js_file"
      exit 1
    fi
    TEST_FILES+=("$js_file")
  done
else
  # Auto-discover all test files
  while IFS= read -r -d '' file; do
    TEST_FILES+=("$file")
  done < <(find src -path '*/__tests__/test-*.js' -print0 2>/dev/null)
fi

if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo "No test files found."
  exit 0
fi

echo "Found ${#TEST_FILES[@]} test file(s)."
echo ""

# ── Run tests ────────────────────────────────────────────────────────────────

FAILED=0
PASSED=0

for test_file in "${TEST_FILES[@]}"; do
  echo "━━━ Running: $test_file ━━━"
  if qjs --module dev/js-harness/runner.js "$test_file"; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILED" -eq 0 ]; then
  echo "  All $PASSED test suite(s) passed."
else
  echo "  $FAILED of $((PASSED + FAILED)) test suite(s) failed."
  exit 1
fi

# Testing Skills

How to use the developer tools to validate and test skills.

## Quick Reference

```bash
cd dev

# Validate all skills
npm run validate

# Test a specific skill
npx tsx harness/runner.ts ../skills/price-tracker --verbose

# Security scan
npm run scan

# Security scan a specific skill
npx tsx security/scan-secrets.ts ../skills/my-skill
```

## Validation (`npm run validate`)

Checks every skill directory in `skills/` and `examples/typescript/`:

### SKILL.md Checks
- File exists and is non-empty
- YAML frontmatter present with `---` delimiters
- `name` field present and matches directory name
- `name` follows lowercase-hyphens convention
- `description` field present and non-empty
- Markdown body is non-empty

### skill.ts Checks (if present)
- File can be imported without errors
- Has a default export
- `name`, `description`, `version` present
- `name` matches directory name
- `version` follows semver pattern
- Hooks are functions
- Tools have valid `definition` + `execute`
- `tickInterval` >= 1000ms if set

### Example Output

```
AlphaHuman Skills Validator

  Found 4 skill(s) to validate.

  skills/price-tracker
    ✓ All checks passed

  skills/portfolio-analysis
    ✓ All checks passed

  examples/typescript/simple-tool
    ✓ All checks passed

Summary
  Skills:   4
  ✓ Passed:   4
  ✗ Errors:   0
  ! Warnings: 0
```

## Test Harness (`npx tsx harness/runner.ts`)

Loads a skill and exercises all its hooks and tools against a mock context.

### What It Tests

1. **SKILL.md**: Exists, has frontmatter, has content
2. **skill.ts structure**: Default export, name, description, version
3. **Lifecycle hooks**: Runs each defined hook in order:
   - onLoad → onSessionStart → onBeforeMessage → onAfterResponse → onTick → onMemoryFlush → onSessionEnd → onUnload
4. **Tools**: Auto-generates arguments from JSON Schema and calls `execute()`

### Verbose Mode

```bash
npx tsx harness/runner.ts ../skills/price-tracker --verbose
```

Shows additional details:
- Log messages emitted during hook execution
- Mock context state after all hooks run
- Full tool execution results

### Example Output

```
Testing skill: price-tracker
  Directory: /path/to/skills/price-tracker

SKILL.md
  ✓ SKILL.md exists
  ✓ Has YAML frontmatter
  ✓ Content length: 1842 chars

skill.ts
  ✓ skill.ts exists
  ✓ Has default export
  ✓ name: "price-tracker"
  ✓ description: "Track crypto token prices with alerts"
  ✓ version: 1.0.0
  ✓ tickInterval: 60000ms

Lifecycle Hooks
  ✓ onLoad: OK
  ✓ onSessionStart: OK
  onBeforeMessage: not defined
  onAfterResponse: not defined
  ✓ onTick: OK
  onMemoryFlush: not defined
  onSessionEnd: not defined
  onUnload: not defined

Tools (1)
  ✓ set_price_alert: returned "Price alert set: test-value above $42"

Summary
  ✓ 10 passed   ✗ 0 failed   ! 0 warnings
```

## Mock Context

The test harness uses `createMockContext()` from `dev/harness/mock-context.ts`. You can also use it directly in custom test scripts:

```typescript
import { createMockContext } from "./dev/harness/mock-context.js";

const { ctx, inspect } = createMockContext({
  initialData: {
    "alerts.json": JSON.stringify([{ token: "ETH", price: 4000 }]),
  },
  initialMemory: {
    "user-prefs": '{"currency":"EUR"}',
  },
  sessionId: "test-session",
});

// Run hooks
await skill.hooks?.onLoad?.(ctx);

// Inspect results
console.log(inspect.getLogs());        // ["Price tracker loaded"]
console.log(inspect.getData());        // { "alerts.json": "..." }
console.log(inspect.getMemory());      // { "user-prefs": "..." }
console.log(inspect.getState());       // {}
console.log(inspect.getRegisteredTools());  // []
console.log(inspect.getEmittedEvents());    // []
```

### Mock Context Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialData` | `Record<string, string>` | `{}` | Pre-populate data directory files |
| `initialMemory` | `Record<string, string>` | `{}` | Pre-populate memory files |
| `initialEntities` | `Entity[]` | `[]` | Pre-populate entity graph |
| `initialState` | `Record<string, unknown>` | `{}` | Pre-populate state store |
| `sessionId` | `string` | `"test-session-001"` | Session ID |
| `dataDir` | `string` | `"/mock/data"` | Data directory path |

## Security Scanner (`npm run scan`)

Scans skill source files for security issues.

### Error Patterns (block PRs)
- Hardcoded API keys and Bearer tokens
- `eval()` or `Function()` usage
- AWS access key patterns
- Hardcoded secret assignments

### Warning Patterns (advisory)
- Direct `fs` module imports
- `fetch()` or `XMLHttpRequest` usage
- `process.env` access
- `require()` calls
- `localStorage`/`sessionStorage` usage
- Possible hex API keys
- Long base64 strings

### Example Output

```
AlphaHuman Skills Security Scanner

  Scanning 4 file(s)...

  ✓ skills/price-tracker/skill.ts: clean
  ✓ skills/portfolio-analysis/skill.ts: clean
  ✓ skills/on-chain-lookup/skill.ts: clean
  ✓ skills/trading-signals/skill.ts: clean

Summary
  Files scanned: 4
  ✗ Errors:   0
  ! Warnings: 0
```

## CI Integration

All these tools run automatically on pull requests via GitHub Actions. See `.github/workflows/validate-skills.yml`.

The CI pipeline runs:
1. `npm run validate` — Structure validation
2. `npx tsc --noEmit` — Type checking
3. `npm run scan` — Security scanning
4. Test harness on every skill with a `skill.ts`

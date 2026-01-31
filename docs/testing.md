# Testing Skills

How to use the developer tools to validate and test skills.

## Quick Reference

```bash
# Validate all skills
python -m dev.validate.validator

# Test a specific skill
python -m dev.harness.runner skills/my-skill --verbose

# Security scan
python -m dev.security.scan_secrets

# Test setup flow interactively
python scripts/test-setup.py skills/my-skill

# Interactive server REPL (browse and call tools live)
python scripts/test-server.py
```

## Validation (`python -m dev.validate.validator`)

Checks every skill directory in `skills/` and `examples/`:

### skill.py Checks

- File exists
- Has a `skill` export
- `skill` is a `SkillDefinition` instance
- `name`, `description`, `version` present
- `name` matches directory name
- `name` follows lowercase-hyphens convention
- `version` follows semver pattern
- Hooks are callable (async functions)
- Tools have valid `definition` + `execute`
- `tick_interval` >= 1000ms if set
- If `has_setup=True`, `on_setup_start` and `on_setup_submit` are defined
- If `has_setup=False` but setup hooks exist, emits a warning

### Example Output

```
AlphaHuman Skills Validator

  Found 2 skill(s) to validate.

  skills/telegram
    OK  All checks passed

  examples/tool-skill
    OK  All checks passed

Summary
  Skills:    2
  OK Passed: 2
  X  Errors: 0
  !  Warnings: 0
```

## Test Harness (`python -m dev.harness.runner`)

Loads a skill and exercises all its hooks and tools against a mock context.

### What It Tests

1. **skill.py structure**: Has `skill` export with name, description, version
2. **Lifecycle hooks**: Runs each defined hook in order:
   - on_load -> on_session_start -> on_before_message -> on_after_response -> on_tick -> on_memory_flush -> on_session_end -> on_unload
3. **Setup flow** (if `has_setup=True`):
   - Calls `on_setup_start`, validates returns a `SetupStep` with fields
   - Generates dummy values from field schemas, calls `on_setup_submit`
   - Calls `on_setup_cancel`, verifies no exception
4. **Tools**: Auto-generates arguments from JSON Schema and calls `execute()`

### Verbose Mode

```bash
python -m dev.harness.runner skills/my-skill --verbose
```

Shows additional details:
- Log messages emitted during hook execution
- Mock context state after all hooks run
- Full tool execution results

### Example Output

```
Testing skill: my-skill
  Directory: /path/to/skills/my-skill

skill.py
  OK  Has skill export
  OK  name: "my-skill"
  OK  description: "What this skill does"
  OK  version: 1.0.0

Lifecycle Hooks
  OK  on_load: OK
  OK  on_session_start: OK
  --  on_before_message: not defined
  --  on_after_response: not defined
  OK  on_tick: OK
  --  on_memory_flush: not defined
  --  on_session_end: not defined
  --  on_unload: not defined

Setup Flow
  OK  on_setup_start: returned step with 2 fields
  OK  on_setup_submit: returned result with status=error
  OK  on_setup_cancel: OK

Tools (1)
  OK  my_tool: returned "Result: test-value"

Summary
  OK 8 passed   X 0 failed   ! 0 warnings
```

## Interactive Setup Tester (`python scripts/test-setup.py`)

Tests a skill's interactive setup flow with real terminal input.

```bash
python scripts/test-setup.py skills/telegram
```

Features:
- Renders multi-step forms in the terminal
- Supports all field types: text, password, number, boolean, select, multiselect
- Shows field-level validation errors on retry
- Persists config to the skill's `data/` directory on completion
- Cancel with Ctrl+C at any point

## Interactive Server REPL (`python scripts/test-server.py`)

Browse and call all tools in a running skill server.

```bash
python scripts/test-server.py
```

Features:
- Loads saved session or runs setup flow automatically
- Groups tools by category (Chat, Message, Contact, Admin, etc.)
- Search tools by name or description
- Interactive argument collection from JSON Schema
- Pretty-printed JSON results
- Real-time skill logs on stderr

## Security Scanner (`python -m dev.security.scan_secrets`)

Scans skill source files for security issues.

### Error Patterns (block PRs)

- Hardcoded API keys and Bearer tokens
- `eval()` or `exec()` usage
- AWS access key patterns
- Hardcoded secret assignments

### Warning Patterns (advisory)

- Direct `os` or `subprocess` module imports
- `requests` or `urllib` usage (should use ctx methods)
- `os.environ` access
- Possible hex API keys
- Long base64 strings

### Example Output

```
AlphaHuman Skills Security Scanner

  Scanning 2 file(s)...

  OK  skills/telegram/skill.py: clean
  OK  skills/telegram/setup.py: clean

Summary
  Files scanned: 2
  X  Errors:   0
  !  Warnings: 0
```

## CI Integration

All these tools run automatically on pull requests via GitHub Actions. See `.github/workflows/validate-skills.yml`.

The CI pipeline runs:
1. `python -m dev.validate.validator` -- Structure validation
2. `python -m dev.security.scan_secrets` -- Security scanning
3. `python -m dev.harness.runner` on every skill -- Hook and tool testing

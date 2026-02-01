# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

This is the **AlphaHuman Skills** repository — a plugin/extension system for the AlphaHuman AI agent. Skills extend the agent with domain-specific capabilities for the crypto community platform. This repo is a git submodule of the main AlphaHuman Tauri app.

## Architecture

Each skill is a directory under `skills/` containing:

- **skill.py** — Python module exporting a `skill` variable (a `SkillDefinition` from `dev.types.skill_types`). Provides lifecycle hooks, custom AI tools, and periodic tasks.
- **setup.py** _(optional)_ — Setup flow handlers for interactive configuration wizards (e.g., Telegram auth).
- **manifest.json** — Skill metadata (id, name, version, runtime, dependencies, setup config).

### Skill Lifecycle

`on_load` → `on_session_start` → message loop (`on_before_message` / `on_after_response`) → `on_tick` (periodic) → `on_session_end` → `on_unload`

### Setup Flow (Optional)

Skills with `has_setup=True` define an interactive multi-step configuration wizard:

`on_setup_start` → host renders form → `on_setup_submit` → (next step | validation error | complete) → ... → `on_setup_cancel` (if user aborts)

Communication uses JSON-RPC 2.0 methods: `setup/start`, `setup/submit`, `setup/cancel`.

### SkillContext API

Every hook receives a `SkillContext` with:

| Property                                                | Purpose                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `memory`                                                | Read/write/search the shared memory system                 |
| `session`                                               | Current session manager                                    |
| `tools`                                                 | Register/unregister AI tools at runtime                    |
| `entities`                                              | Query the platform entity graph (contacts, chats, wallets) |
| `data_dir`                                              | Path to skill's isolated persistent data directory         |
| `read_data(filename)` / `write_data(filename, content)` | File I/O within `data_dir`                                 |
| `log(message)`                                          | Debug logging                                              |
| `get_state()` / `set_state(partial)`                    | Skill state store                                          |
| `emit_event(name, data)`                                | Emit events for intelligence rules                         |
| `get_options()`                                         | Returns current runtime option values as a dict            |
| `skills`                                                | Discover and interact with other skills (SkillsManager)    |

### Tool Registration Pattern

Skills expose tools to the AI via the `tools` list. Each tool has a `definition` (ToolDefinition with name, description, JSON Schema parameters) and an `execute(args)` async function returning `ToolResult(content=...)`.

### Options System

Skills can define runtime-configurable options via the `options` list on `SkillDefinition`. Each option is a `SkillOptionDefinition` with a name, type (`boolean`, `text`, `number`, `select`), label, and optional `tool_filter`. Boolean options with `tool_filter` automatically include/exclude tools from `tools/list` based on their value. Options are persisted to `options.json` in the skill's data directory.

JSON-RPC methods: `options/list`, `options/get`, `options/set`, `options/reset`.

### Disconnect Capability

Skills with `has_disconnect=True` must implement an `on_disconnect` hook. This provides a standardized way for the frontend to trigger a clean disconnection (close connections, clear credentials). Called via `skill/disconnect` JSON-RPC method.

### Triggers System

Skills can declare trigger types via `trigger_schema` on `SkillDefinition`. The LLM creates trigger instances through auto-generated tools. Skills evaluate conditions in their event handlers and fire triggers via `ctx.fire_trigger()`, which notifies the host to start a new AI conversation.

**Trigger Schema**: Declared on `SkillDefinition.trigger_schema` using `TriggerSchema` (contains `TriggerTypeDefinition` objects). Each type declares `condition_fields` (fields usable in conditions) and `config_schema` (type-specific configuration).

**Trigger Hooks**:
- `on_trigger_register(ctx, trigger)` — Called when a trigger is created or loaded from persistence
- `on_trigger_remove(ctx, trigger_id)` — Called when a trigger is deleted

**SkillContext methods**:
- `fire_trigger(trigger_id, matched_data, context)` — Fire-and-forget; sends `triggers/fired` reverse RPC to host
- `get_triggers()` — Returns all registered trigger instances

**Conditions**: Recursive model supporting `regex`, `keyword`, `threshold`, and compound `and`/`or`/`not`. Evaluated by `dev.utils.conditions.evaluate_condition()`.

**Auto-generated tools** (added to `tools/list` when `trigger_schema` is present): `list-trigger-types`, `list-triggers`, `create-trigger`, `update-trigger`, `delete-trigger`, `get-trigger`.

**JSON-RPC methods**: `triggers/types`, `triggers/list`, `triggers/create`, `triggers/update`, `triggers/delete`, `triggers/get`. Reverse RPC: `triggers/fired`.

**Persistence**: Triggers are persisted to `triggers.json` in the skill's data directory and reloaded on `skill/load`.

### Inter-Skill Communication (Interop)

Skills can discover each other, request data, and call functions across skill boundaries — all routed through the host IPC. Skills declare what they expose via `interop_schema` on `SkillDefinition`, with per-endpoint visibility controlling access.

**Visibility Model**: Per-endpoint `visibility: list[Literal["skills", "frontend"]]`. `[]` = private, `["skills"]` = other skills can access, `["frontend"]` = frontend can access, `["skills", "frontend"]` = both.

**Interop Schema**: Declared on `SkillDefinition.interop_schema` using `InteropSchema` containing `ExposedDataDefinition` and `ExposedFunctionDefinition` objects. Each has a `name`, `description`, `visibility`, and async `handler`.

**SkillContext.skills** (SkillsManager protocol):
- `list_skills()` — Discover all registered skills
- `get_skill(skill_id)` — Get info about a specific skill
- `list_data(skill_id?)` — List exposed data endpoints
- `list_functions(skill_id?)` — List exposed functions
- `request_data(skill_id, data_name, params?)` — Request data from another skill
- `call_function(skill_id, function_name, arguments?)` — Call a function on another skill

**Interop Hooks** (optional interceptors on incoming requests):
- `on_interop_data(ctx, caller_skill_id, data_name, params) -> dict | None` — intercept data requests
- `on_interop_call(ctx, caller_skill_id, function_name, arguments) -> dict | None` — intercept function calls

**Auto-generated tools** (always present on every skill): `list-skills`, `list-skill-data`, `list-skill-functions`, `request-skill-data`, `call-skill-function`.

**Forward RPC** (host → skill): `interop/getData`, `interop/callFunction`, `interop/listExposed`.

**Reverse RPC** (skill → host): `skills/list`, `skills/get`, `skills/listData`, `skills/listFunctions`, `skills/requestData`, `skills/callFunction`.

**Types**: `from dev.types.interop_types import ExposedDataDefinition, ExposedFunctionDefinition, InteropSchema, SkillInfo, ExposedDataInfo, ExposedFunctionInfo`.

## Repository Structure

```
skills/                          # Repo root
├── skills/                      # Production skills
│   └── telegram/                # Telegram integration (75+ tools)
├── dev/                         # Developer tooling (Python)
│   ├── pyproject.toml           # Dependencies: pydantic>=2.0
│   ├── types/
│   │   ├── skill_types.py       # Pydantic v2 type definitions
│   │   ├── setup_types.py       # Setup flow types (SetupStep, SetupField, etc.)
│   │   ├── trigger_types.py     # Trigger/automation types (TriggerCondition, TriggerInstance, etc.)
│   │   └── interop_types.py     # Inter-skill communication types (InteropSchema, ExposedDataDefinition, etc.)
│   ├── utils/
│   │   └── conditions.py        # Trigger condition evaluator (regex, keyword, threshold, compound)
│   ├── runtime/
│   │   ├── server.py            # asyncio JSON-RPC 2.0 server
│   │   └── interop.py           # Inter-skill communication runtime helpers
│   ├── harness/                 # Mock context + test runner
│   ├── validate/                # skill.py validator
│   ├── scaffold/                # Interactive skill scaffolder
│   ├── security/                # Secret/pattern scanner
│   └── catalog/                 # Skills catalog builder
├── examples/                    # Example skills
│   ├── prompt-only/             # Prompt-only example (no code)
│   └── tool-skill/              # Python tool example
├── prompts/                     # Non-coder prompt templates
│   ├── generate-skill.md
│   ├── refine-skill.md
│   └── categories/
├── docs/                        # Developer documentation
├── scripts/                     # Developer scripts
│   ├── test-setup.py            # Interactive setup flow tester
│   ├── test-server.py           # Interactive server REPL for tools
│   ├── test-entities.py         # Entity emission tester (live Telegram)
│   ├── debug-graph.py           # Entity graph inspector / REPL
│   └── update-catalog.py        # Skills catalog builder
├── .github/                     # CI/CD and PR templates
├── CONTRIBUTING.md              # Contribution guidelines
└── README.md                    # Project README
```

## Dev Tooling Commands

All dev tools are Python and live in `dev/`. Install once with pip:

```bash
pip install -e dev/

# Validate all skills (structure + types)
python -m dev.validate.validator

# Test a specific skill with mock context
python -m dev.harness.runner skills/telegram --verbose

# Test a skill's interactive setup flow
python scripts/test-setup.py skills/telegram

# Interactive server REPL — connect, browse tools, call them live
python scripts/test-server.py

# Update the skills catalog
python scripts/update-catalog.py

# Security scan all skills
python -m dev.security.scan_secrets

# Scaffold a new skill interactively
python -m dev.scaffold.new_skill

# Build skills catalog
python -m dev.catalog.build_catalog
```

Or use the CLI entry points after `pip install -e dev/`:

```bash
skill-validate
skill-test skills/telegram --verbose
skill-scan
skill-new my-skill
skill-catalog
```

## Code Quality Tools

The repository uses automated code quality checks that run on pre-push:

- **Ruff** — Fast Python linter and formatter
- **MyPy** — Static type checker

**IMPORTANT: Always run `ruff check .` and `ruff format .` after making changes and fix any errors before considering the task complete.**

### Setup

Install development dependencies:

```bash
pip install -r requirements-dev.txt
```

### Manual Usage

```bash
# Run linter (must pass before finishing)
ruff check .

# Format code (run this to auto-fix formatting)
ruff format .

# Verify formatting without modifying files
ruff format --check .

# Type checking
mypy .
```

### Pre-Push Hook

A pre-push git hook automatically runs all checks before pushing. The hook runs:

- `ruff check .` — Linting
- `ruff format --check .` — Format verification
- `mypy .` — Type checking

If any check fails, the push is blocked. Fix the issues and try again.

To bypass the hook (not recommended):

```bash
git push --no-verify
```

## Creating a New Skill

1. Use the scaffolder: `python -m dev.scaffold.new_skill my-skill`
2. Or copy an example from `examples/tool-skill/`
3. Edit `skill.py` — implement hooks and tools
4. Optionally add `setup.py` if the skill needs interactive configuration
5. Validate: `python -m dev.validate.validator`
6. Test: `python -m dev.harness.runner skills/your-skill-name`
7. Submit a pull request

## Key Constraints

- All skills are Python — no TypeScript, no SKILL.md prompt files
- Types come from `dev.types.skill_types` and `dev.types.setup_types` (Pydantic v2 models)
- `tick_interval` is in milliseconds (e.g., `60_000` for one minute), minimum 1000
- Data persistence uses `read_data`/`write_data` with JSON files in the skill's `data/` directory
- `on_before_message` and `on_after_response` can transform content by returning a string; other hooks cannot
- Hooks have a 10-second timeout — keep them fast
- Skills cannot access other skills' data directories
- **No underscores in skill names** — skill names must be lowercase-hyphens (e.g., `my-skill`, not `my_skill`). Underscores are reserved for tool namespacing (`skillId__toolName`). If a skill name contains an underscore, replace it with a dash. The validator and scaffolder both enforce this.
- Skills with `has_setup=True` must implement `on_setup_start` and `on_setup_submit` hooks
- Skills with `has_disconnect=True` must implement an `on_disconnect` hook
- Skills with `trigger_schema` should implement `on_trigger_register` and `on_trigger_remove` hooks. Types from `dev.types.trigger_types`.
- Skills with `interop_schema` expose data/functions to other skills and the frontend. Types from `dev.types.interop_types`. Interop hooks (`on_interop_data`, `on_interop_call`) are optional interceptors for incoming requests.
- **Split large files into smaller pieces** — avoid writing monolithic files. When a module exceeds ~300 lines, split it into logical sub-modules (e.g., separate files for types, handlers, constants, options). This applies to skill implementations, dev tooling, and any other code in this repo.

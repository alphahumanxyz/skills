# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

This is the **AlphaHuman Skills** repository — a plugin/extension system for the AlphaHuman AI agent. Skills extend the agent with domain-specific capabilities for the crypto community platform. This repo is a git submodule of the main AlphaHuman Tauri app.

## Architecture

Each skill is a directory under `skills/` containing:

- **skill.py** — Python module exporting a `skill` variable (a `SkillDefinition` from `dev.types.skill_types`). Provides lifecycle hooks, custom AI tools, and periodic tasks.

### Skill Lifecycle

`on_load` → `on_session_start` → message loop (`on_before_message` / `on_after_response`) → `on_tick` (periodic) → `on_session_end` → `on_unload`

### SkillContext API

Every hook receives a `SkillContext` with:

| Property | Purpose |
|----------|---------|
| `memory` | Read/write/search the shared memory system |
| `session` | Current session manager |
| `tools` | Register/unregister AI tools at runtime |
| `entities` | Query the platform entity graph (contacts, chats, wallets) |
| `data_dir` | Path to skill's isolated persistent data directory |
| `read_data(filename)` / `write_data(filename, content)` | File I/O within `data_dir` |
| `log(message)` | Debug logging |
| `get_state()` / `set_state(partial)` | Skill state store |
| `emit_event(name, data)` | Emit events for intelligence rules |

### Tool Registration Pattern

Skills expose tools to the AI via the `tools` list. Each tool has a `definition` (ToolDefinition with name, description, JSON Schema parameters) and an `execute(args)` async function returning `ToolResult(content=...)`.

## Repository Structure

```
skills/                          # Repo root
├── skills/                      # Production skills
│   ├── telegram/
│   ├── price-tracker/
│   ├── portfolio-analysis/
│   ├── on-chain-lookup/
│   └── trading-signals/
├── TEMPLATE/                    # Skill template
├── dev/                         # Developer tooling (Python)
│   ├── pyproject.toml           # Dependencies: pydantic>=2.0
│   ├── types/skill_types.py     # Pydantic v2 type definitions
│   ├── runtime/server.py        # asyncio JSON-RPC 2.0 server
│   ├── harness/                 # Mock context + test runner
│   ├── validate/                # skill.py validator
│   ├── scaffold/                # Interactive skill scaffolder
│   ├── security/                # Secret/pattern scanner
│   └── catalog/                 # Skills catalog builder
├── examples/                    # Example skills
│   ├── prompt-only/
│   └── tool-skill/              # Python tool example
├── prompts/                     # Non-coder prompt templates
│   ├── generate-skill.md
│   ├── refine-skill.md
│   └── categories/
├── docs/                        # Developer documentation
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
python -m dev.harness.runner skills/price-tracker --verbose

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
skill-test skills/price-tracker --verbose
skill-scan
skill-new my-skill
skill-catalog
```

## Creating a New Skill

1. Use the scaffolder: `python -m dev.scaffold.new_skill my-skill`
2. Or copy an example from `examples/tool-skill/`
3. Edit `skill.py` — implement hooks and tools
4. Validate: `python -m dev.validate.validator`
5. Test: `python -m dev.harness.runner skills/your-skill-name`
6. Submit a pull request

## Key Constraints

- Skills are self-contained — no pip dependencies, no build step
- Types come from `dev.types.skill_types` (Pydantic v2 models)
- `tick_interval` is in milliseconds (e.g., `60_000` for one minute), minimum 1000
- Data persistence uses `read_data`/`write_data` with JSON files in the skill's `data/` directory
- `on_before_message` and `on_after_response` can transform content by returning a string; other hooks cannot
- Hooks have a 10-second timeout — keep them fast
- Skills cannot access other skills' data directories
- Skill names must be lowercase-hyphens and match the directory name

# AlphaHuman Skills

A plugin system for the [AlphaHuman](https://github.com/bnbpad/alphahuman) crypto community platform. Skills give the AI agent domain-specific knowledge, custom tools, and automated behaviors.

## How Skills Work

A skill is a directory with one or two files:

| File | Required | Purpose |
|------|----------|---------|
| `SKILL.md` | Yes | Markdown instructions the AI follows (YAML frontmatter + prompt) |
| `skill.ts` | No | TypeScript code for custom tools, lifecycle hooks, persistent state |

**Prompt-only skills** (just `SKILL.md`) need zero code. The AI reads the instructions and applies them when relevant. **Coded skills** add a `skill.ts` to register tools, react to events, store data, or run periodic background tasks.

```
skills/price-tracker/
├── SKILL.md      # "When the user asks about token prices, do X, Y, Z..."
├── skill.ts      # Registers `set_price_alert` tool, runs onTick every 60s
└── data/         # Auto-created persistent storage
```

## Available Skills

| Skill | Description | Type |
|-------|-------------|------|
| [`price-tracker`](skills/price-tracker/) | Track token prices, set alerts, analyze movements | Coded |
| [`portfolio-analysis`](skills/portfolio-analysis/) | Portfolio allocation, PnL, risk metrics | Coded |
| [`on-chain-lookup`](skills/on-chain-lookup/) | Wallet balances, transactions, contract info | Coded |
| [`trading-signals`](skills/trading-signals/) | Technical analysis, support/resistance, trend detection | Coded |

## Quick Start

### Create a skill in 3 steps

```bash
# 1. Install dev tools (one time)
cd dev && npm install

# 2. Scaffold a new skill
npx tsx scaffold/new-skill.ts

# 3. Validate it
npm run validate
```

### Or start from the template

```bash
cp -r TEMPLATE/ skills/my-skill/
# Edit skills/my-skill/SKILL.md
```

## SKILL.md Format

```markdown
---
name: my-skill
description: One sentence describing what this skill does.
---

# My Skill

## Overview
What this skill does and what problems it solves.

## When to Use
Activate this skill when the user:
- Asks about X
- Wants to do Y
- Mentions Z

## Instructions
1. **Parse the request** -- identify tokens, addresses, etc.
2. **Fetch data** -- use web_search for live information.
3. **Format the response** -- present clearly with numbers in monospace.

## Output Format
[Show the exact format with placeholders]

## Examples

### Example 1: Simple Query
**User**: What's the price of ETH?
**Agent**: ETH/USD: `$3,421.50` (24h: +2.3%)

## Limitations
- Data comes from web search, not real-time feeds
- Cannot execute transactions
```

## skill.ts Format

```typescript
import type { SkillDefinition, SkillContext } from "@alphahuman/skill-types";

const skill: SkillDefinition = {
  name: "my-skill",
  description: "What this skill does",
  version: "1.0.0",

  hooks: {
    async onLoad(ctx: SkillContext) {
      ctx.log("Skill loaded");
    },
  },

  tools: [
    {
      definition: {
        name: "my_tool",
        description: "What the tool does",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string", description: "Input value" },
          },
          required: ["input"],
        },
      },
      async execute(args) {
        const { input } = args as { input: string };
        return { content: `Result: ${input}` };
      },
    },
  ],

  tickInterval: 60_000, // optional: periodic onTick every 60s
};

export default skill;
```

## Lifecycle Hooks

```
App Start ── onLoad
                │
        ┌── onSessionStart
        │       │
        │   onBeforeMessage  ← can transform user message
        │       │
        │   [AI processes]
        │       │
        │   onAfterResponse  ← can transform AI response
        │       │
        └── onSessionEnd
                │
App Stop ── onUnload           onTick ← runs every tickInterval ms
```

| Hook | Can Transform? | Use Case |
|------|:--------------:|----------|
| `onLoad` | | Load cached data at startup |
| `onUnload` | | Persist state on shutdown |
| `onSessionStart` | | Report cached alerts, load prefs |
| `onSessionEnd` | | Save session summary |
| `onBeforeMessage` | Yes | Annotate messages with context |
| `onAfterResponse` | Yes | Append disclaimers to responses |
| `onMemoryFlush` | | Save data before memory compaction |
| `onTick` | | Background monitoring, periodic checks |

All hooks have a **10-second timeout**. See [Lifecycle docs](docs/lifecycle.md) for details.

## SkillContext API

Every hook receives a `ctx` object:

```typescript
ctx.memory          // Read/write/search shared memory
ctx.session         // Session-scoped key-value store
ctx.tools           // Register/unregister tools at runtime
ctx.entities        // Query entity graph (contacts, wallets, chats)
ctx.dataDir         // Path to skill's data directory
ctx.readData(file)  // Read from data directory
ctx.writeData(file) // Write to data directory
ctx.log(msg)        // Debug logging
ctx.getState()      // Read skill state store
ctx.setState(patch) // Update skill state store
ctx.emitEvent(name) // Emit events for intelligence rules
```

See [API Reference](docs/api-reference.md) for the full type definitions.

## Dev Tooling

All tools live in `dev/`. Install once with `cd dev && npm install`.

```bash
npm run validate                                     # Validate all skills
npm run scan                                         # Security scan all skills
npm run new                                          # Scaffold a new skill
npx tsx harness/runner.ts ../skills/my-skill          # Test a specific skill
npx tsx harness/runner.ts ../skills/my-skill --verbose # Verbose test output
npx tsc --noEmit                                     # Type-check everything
```

### Validator

Checks every skill's `SKILL.md` (frontmatter, required fields, naming) and `skill.ts` (exports, types, tool schemas, tick interval).

### Test Harness

Loads a skill into a mock context, runs all lifecycle hooks in order, and auto-tests every tool with generated arguments from its JSON Schema.

### Security Scanner

Regex-based scanner that flags hardcoded secrets, `eval()`, direct filesystem access, network requests, and other patterns that don't belong in skills. Errors block PRs; warnings are advisory.

## Examples

| Example | Pattern | Description |
|---------|---------|-------------|
| [`prompt-only`](examples/typescript/prompt-only/) | No code | DeFi yield aggregator using only SKILL.md instructions |
| [`simple-tool`](examples/typescript/simple-tool/) | One tool | Impermanent loss calculator with `calculate_il` tool |
| [`stateful-skill`](examples/typescript/stateful-skill/) | Full lifecycle | Whale watcher with persistence, onTick, onLoad/onUnload |
| [`message-transform`](examples/typescript/message-transform/) | Hooks | Address expander (onBeforeMessage) + disclaimer appender (onAfterResponse) |
| [`python/tool-skill`](examples/python/tool-skill/) | Experimental | Python subprocess skill using JSON-RPC 2.0 over stdin/stdout |

## Prompt Templates (No Code Required)

The [`prompts/`](prompts/) directory has ready-to-use prompts for generating skills with ChatGPT or Claude. Paste a prompt, describe your idea, get a complete SKILL.md.

| Prompt | Description |
|--------|-------------|
| [`generate-skill.md`](prompts/generate-skill.md) | General-purpose skill generator |
| [`refine-skill.md`](prompts/refine-skill.md) | Improve an existing SKILL.md |
| [`categories/defi.md`](prompts/categories/defi.md) | DeFi yield, lending, LP skills |
| [`categories/trading.md`](prompts/categories/trading.md) | Technical analysis, signals, risk management |
| [`categories/research.md`](prompts/categories/research.md) | Token fundamentals, on-chain analytics |
| [`categories/community.md`](prompts/categories/community.md) | Moderation, sentiment, onboarding |
| [`categories/nft.md`](prompts/categories/nft.md) | Floor prices, rarity, mint tracking |
| [`categories/security.md`](prompts/categories/security.md) | Audit summaries, scam detection, wallet safety |

## Documentation

| Doc | Description |
|-----|-------------|
| [Getting Started](docs/getting-started.md) | Prerequisites, first skill, test, submit |
| [Architecture](docs/architecture.md) | How the skill system loads, isolates, and runs skills |
| [API Reference](docs/api-reference.md) | Complete SkillDefinition, SkillContext, SkillTool types |
| [Lifecycle](docs/lifecycle.md) | Hook timing, execution order, timeout rules |
| [Testing](docs/testing.md) | Validator, harness, mock context, security scanner |
| [Python Skills](docs/python-skills.md) | Experimental subprocess runtime and JSON-RPC protocol |
| [Publishing](docs/publishing.md) | PR workflow, naming conventions, common rejections |

## Repository Structure

```
skills/                           # Repo root
├── skills/                       # Production skills
│   ├── price-tracker/
│   ├── portfolio-analysis/
│   ├── on-chain-lookup/
│   └── trading-signals/
├── TEMPLATE/                     # Blank skill template
├── dev/                          # Developer tooling
│   ├── types/skill-types.ts      # Standalone type definitions
│   ├── harness/                  # Mock context + test runner
│   ├── validate/                 # Frontmatter + skill.ts validators
│   ├── scaffold/                 # Interactive skill scaffolder
│   └── security/                 # Secret/pattern scanner
├── examples/
│   ├── typescript/               # 4 example skills
│   └── python/                   # Experimental Python examples
├── prompts/                      # AI prompt templates for non-coders
│   └── categories/               # Domain-specific generators
├── docs/                         # Developer documentation
├── .github/                      # CI workflows + PR template
├── CONTRIBUTING.md               # How to contribute
└── CLAUDE.md                     # Guidance for Claude Code
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. The short version:

1. Fork and clone
2. `cd dev && npm install`
3. `npx tsx scaffold/new-skill.ts your-skill-name`
4. Write your `SKILL.md` (and optionally `skill.ts`)
5. `npm run validate && npm run scan`
6. Submit a pull request

CI runs validation, type checking, security scanning, and the test harness automatically on every PR.

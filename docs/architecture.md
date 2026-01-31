# Architecture

How the AlphaHuman skill system works.

## Overview

Skills extend the AlphaHuman AI agent with domain-specific knowledge and capabilities. The system is designed to be simple: a skill is a directory with a markdown file and an optional TypeScript module.

```
skills/
├── my-skill/
│   ├── SKILL.md        # Instructions for the AI (required)
│   ├── skill.ts        # Code hooks + tools (optional)
│   └── data/           # Persistent storage (auto-created)
```

## Two Types of Skills

### Prompt-Only Skills

Just a `SKILL.md` file. The AI reads the instructions and follows them when relevant. No code, no build step. Powerful skills can be built with instructions alone.

**When to use**: The AI can accomplish the task using its existing tools (web search, memory, etc.) and just needs domain-specific instructions.

### Coded Skills

A `SKILL.md` plus a `skill.ts` module. The code provides lifecycle hooks, custom tools, and persistent state.

**When to use**: You need custom calculations, periodic monitoring, message transformation, or persistent data tracking.

## Loading Pipeline

```
1. Runtime scans skills/ directories
2. For each directory with SKILL.md:
   a. Parse YAML frontmatter (name, description)
   b. Load markdown body as AI instructions
   c. If skill.ts exists:
      - Dynamic import
      - Read default export (SkillDefinition)
      - Register hooks, tools, tick interval
3. Inject instructions into AI context when relevant
4. Route tool calls to skill's execute functions
```

## Skill Isolation

Each skill operates in isolation:

- **Data directory**: Each skill gets its own `data/` directory. Skills cannot access other skills' data.
- **Tools**: Each skill's tools are namespaced. No collisions.
- **State**: Each skill has its own state store via `getState()`/`setState()`.
- **No dependencies**: Skills cannot import npm packages or other skills' code.

## Runtime Context

Every hook receives a `SkillContext` object — the skill's interface to the platform:

```
SkillContext
├── memory      → Read/write/search shared memory
├── session     → Current session ID and session-scoped data
├── tools       → Register/unregister tools at runtime
├── entities    → Query the entity graph (contacts, wallets, chats)
├── dataDir     → Path to skill's data directory
├── readData()  → Read file from data directory
├── writeData() → Write file to data directory
├── log()       → Debug logging
├── getState()  → Read skill state store
├── setState()  → Write skill state store
└── emitEvent() → Emit events for intelligence rules
```

## Message Flow

```
User Message
    │
    ▼
onBeforeMessage ─── (skill can transform message) ──→ Transformed Message
    │                                                        │
    ▼                                                        ▼
AI Processes Message ◄──────────────────────────────── AI Context
    │                                                  (includes SKILL.md
    │                                                   instructions)
    ▼
AI Response
    │
    ▼
onAfterResponse ─── (skill can transform response) ──→ Final Response
    │
    ▼
Shown to User
```

## Periodic Tasks

Skills with `tickInterval` set get `onTick` called periodically:

```
onTick → (runs every tickInterval ms)
         minimum: 1000ms
         typical: 60_000ms (1 minute)
```

Ticks run independently of user interactions. Use them for background monitoring (price alerts, whale watching, etc.).

## Data Persistence

Skills persist data using `ctx.readData()` and `ctx.writeData()`:

```typescript
// Save
await ctx.writeData("alerts.json", JSON.stringify(alerts));

// Load
const data = await ctx.readData("alerts.json");
const alerts = JSON.parse(data);
```

Files are stored in the skill's `data/` directory. The runtime creates this directory automatically. Common pattern: load state in `onLoad`, save state in `onUnload` or after modifications.

## Type System

Types are imported from `@alphahuman/skill-types`:

```typescript
import type { SkillDefinition, SkillContext } from "@alphahuman/skill-types";
```

For development, the `dev/types/skill-types.ts` file provides standalone type definitions that don't require the full parent project.

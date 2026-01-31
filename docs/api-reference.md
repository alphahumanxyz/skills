# API Reference

Complete reference for the AlphaHuman skill type system.

## SkillDefinition

The default export of `skill.ts`.

```typescript
interface SkillDefinition {
  name: string;           // Must match directory name (lowercase-hyphens)
  description: string;    // Brief description
  version: string;        // Semver (e.g., "1.0.0")
  hooks?: SkillHooks;     // Lifecycle hooks
  tools?: SkillTool[];    // Custom AI tools
  tickInterval?: number;  // Periodic tick interval in ms (min: 1000)
}
```

## SkillContext

Passed to every hook function. The skill's interface to the platform.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `memory` | `MemoryManager` | Shared memory system |
| `session` | `SessionManager` | Current session |
| `tools` | `UnifiedToolRegistry` | Runtime tool registration |
| `entities` | `EntityManager` | Platform entity graph |
| `dataDir` | `string` | Path to skill's data directory |

### Methods

#### `readData(filename: string): Promise<string>`

Read a file from the skill's `data/` directory.

```typescript
const data = await ctx.readData("config.json");
const config = JSON.parse(data);
```

Throws if file doesn't exist. Wrap in try/catch for optional files.

#### `writeData(filename: string, content: string): Promise<void>`

Write a file to the skill's `data/` directory.

```typescript
await ctx.writeData("config.json", JSON.stringify(config, null, 2));
```

Creates the file if it doesn't exist, overwrites if it does.

#### `log(message: string): void`

Log a debug message.

```typescript
ctx.log("Processing 5 alerts");
```

#### `getState<S>(): S`

Read the skill's in-memory state store.

```typescript
interface MyState { counter: number; }
const state = ctx.getState<MyState>();
```

#### `setState<S>(partial: Partial<S>): void`

Merge values into the skill's state store.

```typescript
ctx.setState({ counter: state.counter + 1 });
```

#### `emitEvent(eventName: string, data: unknown): void`

Emit an event for intelligence rules to react to.

```typescript
ctx.emitEvent("price-alert-triggered", { token: "ETH", price: 4000 });
```

## MemoryManager

Read/write the shared memory system (persists across sessions).

```typescript
interface MemoryManager {
  read(name: string): Promise<string | null>;
  write(name: string, content: string): Promise<void>;
  search(query: string): Promise<Array<{ name: string; excerpt: string }>>;
  list(): Promise<string[]>;
  delete(name: string): Promise<void>;
}
```

### Example

```typescript
// Store a user preference
await ctx.memory.write("user-prefs", JSON.stringify({ currency: "EUR" }));

// Search memory
const results = await ctx.memory.search("ethereum");
// [{ name: "notes.md", excerpt: "...ethereum price was..." }]
```

## SessionManager

Session-scoped data (lost when session ends).

```typescript
interface SessionManager {
  readonly id: string;
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}
```

### Example

```typescript
// Track per-session state
ctx.session.set("queriesThisSession", 0);
const count = ctx.session.get<number>("queriesThisSession") ?? 0;
ctx.session.set("queriesThisSession", count + 1);
```

## UnifiedToolRegistry

Register/unregister tools at runtime (beyond the static `tools` array).

```typescript
interface UnifiedToolRegistry {
  register(tool: SkillTool): void;
  unregister(name: string): void;
  list(): string[];
}
```

### Example

```typescript
// Dynamically add a tool based on session state
ctx.tools.register({
  definition: {
    name: "dynamic_tool",
    description: "A tool added at runtime",
    parameters: { type: "object", properties: {}, required: [] },
  },
  async execute(args) {
    return { content: "Dynamic result" };
  },
});
```

## EntityManager

Query the platform's entity graph (contacts, wallets, chats).

```typescript
interface EntityManager {
  getByTag(tag: string, type?: string): Promise<Entity[]>;
  getById(id: string): Promise<Entity | null>;
  search(query: string): Promise<Entity[]>;
}

interface Entity {
  id: string;
  type: string;
  name: string;
  tags: string[];
  metadata: Record<string, unknown>;
}
```

### Example

```typescript
// Find watched wallets
const wallets = await ctx.entities.getByTag("watched-wallet", "wallet");
for (const w of wallets) {
  ctx.log(`Watching: ${w.name} (${w.metadata.chain})`);
}
```

## SkillTool

Custom tools that the AI can call.

```typescript
interface SkillTool {
  definition: {
    name: string;                    // snake_case tool name
    description: string;             // What the tool does
    parameters: {
      type: "object";
      properties: Record<string, unknown>;  // JSON Schema
      required?: string[];
    };
  };
  execute(args: Record<string, unknown>): Promise<{
    content: string;     // Result text
    isError?: boolean;   // True if execution failed
  }>;
}
```

### Parameter Schema

Tool parameters use JSON Schema. Common property types:

```typescript
// String
{ type: "string", description: "Token symbol" }

// String with choices
{ type: "string", enum: ["above", "below"], description: "Direction" }

// Number
{ type: "number", description: "Price in USD" }

// Boolean
{ type: "boolean", description: "Include historical data" }

// Array
{ type: "array", items: { type: "string" }, description: "Token list" }

// Object
{
  type: "object",
  properties: {
    token: { type: "string" },
    amount: { type: "number" },
  },
  description: "Holding"
}
```

## SkillHooks

Lifecycle hooks — all optional, all async.

```typescript
interface SkillHooks {
  onLoad?(ctx: SkillContext): Promise<void>;
  onUnload?(ctx: SkillContext): Promise<void>;
  onSessionStart?(ctx: SkillContext, sessionId: string): Promise<void>;
  onSessionEnd?(ctx: SkillContext, sessionId: string): Promise<void>;
  onBeforeMessage?(ctx: SkillContext, message: string): Promise<string | void>;
  onAfterResponse?(ctx: SkillContext, response: string): Promise<string | void>;
  onMemoryFlush?(ctx: SkillContext): Promise<void>;
  onTick?(ctx: SkillContext): Promise<void>;
}
```

See [Lifecycle](./lifecycle.md) for detailed hook timing and behavior.

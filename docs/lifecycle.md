# Lifecycle Hooks

Detailed reference for skill lifecycle hooks, execution order, and timeout behavior.

## Execution Order

```
App Startup
    │
    ▼
  onLoad          ← Skill is loaded (once per app launch)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ Session Loop (repeats per chat session)              │
│                                                      │
│   onSessionStart     ← New session begins            │
│       │                                              │
│   ┌───┴──────────────────────────────────────────┐   │
│   │ Message Loop (repeats per message)            │   │
│   │                                               │   │
│   │   onBeforeMessage   ← User sends message      │   │
│   │       │                                       │   │
│   │   [AI processes message with skill context]   │   │
│   │       │                                       │   │
│   │   onAfterResponse   ← AI generates response   │   │
│   │                                               │   │
│   └───────────────────────────────────────────────┘   │
│                                                      │
│   onMemoryFlush        ← Memory compaction event     │
│                                                      │
│   onSessionEnd         ← Session ends                │
│                                                      │
└──────────────────────────────────────────────────────┘
    │
    ▼                    ┌──────────────┐
  onUnload    ← App     │   onTick     │ ← Runs independently
                shutdown │  (periodic)  │   every tickInterval ms
                         └──────────────┘
```

## Hook Reference

### onLoad

```typescript
async onLoad(ctx: SkillContext): Promise<void>
```

Called once when the skill is loaded at app startup.

**Common uses**:
- Load cached data from `ctx.readData()`
- Initialize state via `ctx.setState()`
- Log startup diagnostics

**Example**:
```typescript
async onLoad(ctx) {
  try {
    const data = await ctx.readData("cache.json");
    ctx.setState(JSON.parse(data));
    ctx.log("Cache loaded");
  } catch {
    ctx.log("No cache, starting fresh");
  }
}
```

### onUnload

```typescript
async onUnload(ctx: SkillContext): Promise<void>
```

Called when the app shuts down or the skill is manually unloaded.

**Common uses**:
- Persist state to data directory
- Clean up resources

**Example**:
```typescript
async onUnload(ctx) {
  const state = ctx.getState();
  await ctx.writeData("cache.json", JSON.stringify(state));
}
```

### onSessionStart

```typescript
async onSessionStart(ctx: SkillContext, sessionId: string): Promise<void>
```

Called when a new chat session begins.

**Common uses**:
- Report cached data to the user
- Load session-specific preferences
- Reset session counters

### onSessionEnd

```typescript
async onSessionEnd(ctx: SkillContext, sessionId: string): Promise<void>
```

Called when a chat session ends.

**Common uses**:
- Save session summary
- Clean up session-scoped resources

### onBeforeMessage

```typescript
async onBeforeMessage(ctx: SkillContext, message: string): Promise<string | void>
```

Called before the AI processes a user message. **Can transform the message.**

- Return a `string` to replace the message the AI sees
- Return `void` (or `undefined`) to pass the original message through

**Example**:
```typescript
async onBeforeMessage(ctx, message) {
  // Detect and annotate wallet addresses
  if (message.includes("0x")) {
    return `[Context: message contains wallet address]\n\n${message}`;
  }
  // Return void to pass through unchanged
}
```

### onAfterResponse

```typescript
async onAfterResponse(ctx: SkillContext, response: string): Promise<string | void>
```

Called after the AI generates a response. **Can transform the response.**

- Return a `string` to replace the response shown to the user
- Return `void` to pass the original response through

**Example**:
```typescript
async onAfterResponse(ctx, response) {
  if (response.includes("price") || response.includes("invest")) {
    return response + "\n\n*Not financial advice. DYOR.*";
  }
}
```

### onMemoryFlush

```typescript
async onMemoryFlush(ctx: SkillContext): Promise<void>
```

Called before memory compaction. Use this to persist important data before memory is compressed.

### onTick

```typescript
async onTick(ctx: SkillContext): Promise<void>
```

Called periodically based on `tickInterval`. Runs independently of user interactions.

**Requires**: `tickInterval` set in SkillDefinition (minimum 1000ms).

**Example**:
```typescript
async onTick(ctx) {
  const alerts = JSON.parse(await ctx.readData("alerts.json"));
  for (const alert of alerts) {
    // Check if alert conditions are met
    ctx.log(`Checking alert for ${alert.token}`);
  }
}
```

## Timeout Behavior

**All hooks have a 10-second timeout.** If a hook doesn't resolve within 10 seconds, the runtime:

1. Logs a timeout warning
2. Continues execution (does not crash the app)
3. The hook's return value is ignored

This means:
- Don't make long-running API calls in hooks
- Don't do heavy computation
- If you need more time, cache partial results and continue in the next tick

## Transform Hook Ordering

If multiple skills define `onBeforeMessage` or `onAfterResponse`, they run in skill load order. Each skill's transform feeds into the next:

```
User Message → Skill A onBeforeMessage → Skill B onBeforeMessage → AI

AI Response → Skill A onAfterResponse → Skill B onAfterResponse → User
```

## Error Handling

If a hook throws an error:
1. The error is logged
2. The hook is treated as if it returned `void`
3. Other skills' hooks continue to run
4. The app does not crash

Always use try/catch for operations that might fail (file reads, JSON parsing).

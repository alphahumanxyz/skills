# Python Skills (Experimental)

> **Status: EXPERIMENTAL** — The Python subprocess runtime is not yet implemented in AlphaHuman. These examples demonstrate the planned protocol for when it ships.

## How Python Skills Will Work

Python skills run as subprocess workers, communicating with the AlphaHuman runtime over stdin/stdout using JSON-RPC 2.0.

### Architecture

```
AlphaHuman Runtime                    Python Subprocess
       │                                     │
       │  spawn(python3, skill.py)           │
       │────────────────────────────────────>│
       │                                     │
       │  {"jsonrpc":"2.0","method":         │
       │   "initialize",...}                 │
       │────────────────────────────────────>│
       │                                     │
       │  {"jsonrpc":"2.0","result":         │
       │   {"name":"...","tools":[...]}}     │
       │<────────────────────────────────────│
       │                                     │
       │  {"jsonrpc":"2.0","method":         │
       │   "tools/call",...}                 │
       │────────────────────────────────────>│
       │                                     │
       │  {"jsonrpc":"2.0","result":         │
       │   {"content":"..."}}               │
       │<────────────────────────────────────│
```

### Manifest File

Python skills include a `manifest.json` alongside `SKILL.md`:

```json
{
  "runtime": {
    "type": "subprocess",
    "command": "python3",
    "args": ["skill.py"]
  }
}
```

### JSON-RPC Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `initialize` | Runtime → Skill | Start up, return skill metadata + tool list |
| `tools/call` | Runtime → Skill | Execute a tool with arguments |
| `lifecycle/onLoad` | Runtime → Skill | Skill loaded notification |
| `lifecycle/onSessionStart` | Runtime → Skill | Session started |
| `lifecycle/onSessionEnd` | Runtime → Skill | Session ended |
| `lifecycle/onTick` | Runtime → Skill | Periodic tick |
| `shutdown` | Runtime → Skill | Clean shutdown |

### Prompt-Only Skills

Prompt-only skills work identically in Python — they only need `SKILL.md` with no code. The `examples/python/prompt-only/` example demonstrates this. SKILL.md is language-agnostic.

### Coded Skills

See `examples/python/tool-skill/` for a complete example of a Python skill implementing the JSON-RPC protocol.

## Testing Python Skills

You can test the JSON-RPC protocol manually:

```bash
# Start the skill
python3 examples/python/tool-skill/skill.py

# Send initialize request (paste into stdin)
{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}

# Send a tool call
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "gas_estimate", "arguments": {"chain": "ethereum"}}}

# Shutdown
{"jsonrpc": "2.0", "id": 3, "method": "shutdown", "params": {}}
```

## When Will This Ship?

The subprocess runtime is on the AlphaHuman roadmap. These examples are provided so developers can start building Python skills ahead of the runtime being available. The JSON-RPC protocol is stable and will not change.

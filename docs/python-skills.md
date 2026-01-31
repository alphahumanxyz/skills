# Python Skills

> **Status: EXPERIMENTAL** — The subprocess runtime is not yet implemented. This document describes the planned protocol.

## Overview

Python skills run as subprocess workers, communicating with the AlphaHuman runtime over stdin/stdout using JSON-RPC 2.0. This enables skills to be written in Python (or any language that can read/write JSON over stdio).

## Skill Structure

```
my-python-skill/
├── SKILL.md          # Required: same format as TypeScript skills
├── manifest.json     # Required: runtime configuration
├── skill.py          # Required: JSON-RPC server implementation
└── requirements.txt  # Optional: Python dependencies
```

## Manifest Format

```json
{
  "runtime": {
    "type": "subprocess",
    "command": "python3",
    "args": ["skill.py"]
  }
}
```

The runtime spawns `python3 skill.py` as a child process and communicates via stdin/stdout.

## JSON-RPC Protocol

All messages are single-line JSON objects following JSON-RPC 2.0.

### Request (Runtime → Skill)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {}
}
```

### Response (Skill → Runtime)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Methods

### `initialize`

Sent once after spawning. Return skill metadata and tool definitions.

**Request**: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "name": "my-skill",
    "description": "What this skill does",
    "version": "1.0.0",
    "tools": [
      {
        "name": "my_tool",
        "description": "Tool description",
        "parameters": {
          "type": "object",
          "properties": {
            "input": { "type": "string" }
          },
          "required": ["input"]
        }
      }
    ]
  }
}
```

### `tools/call`

Execute a tool.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "my_tool",
    "arguments": { "input": "hello" }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": "Tool result text"
  }
}
```

### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `lifecycle/onLoad` | Skill loaded |
| `lifecycle/onSessionStart` | Session started (params: `{sessionId}`) |
| `lifecycle/onSessionEnd` | Session ended (params: `{sessionId}`) |
| `lifecycle/onTick` | Periodic tick |

All lifecycle methods should return `{"ok": true}`.

### `shutdown`

Clean shutdown. The skill should exit after responding.

## Implementation Template

```python
#!/usr/bin/env python3
import json
import sys

def handle_request(request):
    method = request.get("method", "")
    params = request.get("params", {})
    req_id = request.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": req_id,
            "result": {
                "name": "my-skill",
                "description": "Description",
                "version": "1.0.0",
                "tools": []
            }
        }
    elif method == "tools/call":
        # Handle tool calls
        return {"jsonrpc": "2.0", "id": req_id, "result": {"content": "ok"}}
    elif method.startswith("lifecycle/"):
        return {"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}
    elif method == "shutdown":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}
    else:
        return {
            "jsonrpc": "2.0", "id": req_id,
            "error": {"code": -32601, "message": f"Unknown: {method}"}
        }

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    request = json.loads(line)
    response = handle_request(request)
    print(json.dumps(response), flush=True)
    if request.get("method") == "shutdown":
        break
```

## Testing

Test manually by running the skill and pasting JSON-RPC requests:

```bash
python3 skill.py
# Paste:
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"my_tool","arguments":{"input":"test"}}}
{"jsonrpc":"2.0","id":3,"method":"shutdown","params":{}}
```

## Example

See `examples/python/tool-skill/` for a complete working example (gas cost estimator).

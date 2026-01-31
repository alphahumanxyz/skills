# Example Skills

Example skills demonstrating different patterns for building AlphaHuman skills.

## Examples

### [prompt-only](prompt-only/)

A prompt-only skill using the legacy SKILL.md format. Demonstrates how instructions alone (no code) can guide the AI agent. This format is being phased out in favor of Python skill.py files.

### [tool-skill](tool-skill/)

A complete Python skill with:
- `SkillDefinition` export with name, description, version
- Lifecycle hooks (`on_load`, `on_session_start`, `on_tick`, etc.)
- Custom tools (`gas_estimate`) with JSON Schema parameters
- Mock-friendly architecture for testing

## Architecture

Skills communicate with the AlphaHuman runtime over stdin/stdout using JSON-RPC 2.0:

```
AlphaHuman Runtime                    Python Subprocess
       │                                     │
       │  spawn(python3, skill.py)           │
       │────────────────────────────────────>│
       │                                     │
       │  {"method": "skill/load"}           │
       │────────────────────────────────────>│
       │                                     │
       │  {"method": "tools/list"}           │
       │────────────────────────────────────>│
       │                                     │
       │  {"result": {"tools": [...]}}       │
       │<────────────────────────────────────│
       │                                     │
       │  {"method": "tools/call"}           │
       │────────────────────────────────────>│
       │                                     │
       │  {"result": {"content": "..."}}     │
       │<────────────────────────────────────│
```

## Testing

```bash
# Install dev tools
pip install -e dev/

# Validate example skills
python -m dev.validate.validator

# Test with mock context
python -m dev.harness.runner examples/tool-skill --verbose
```

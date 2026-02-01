from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Example: append a subtle footer on every 5th message"""

    # Example: append a subtle footer on every 5th message
    count = ctx.session.get("message_count") or 0
    if count > 0 and count % 5 == 0:
        return response + "\n\n---\n_Tip: Use `list_notes` to see your saved notes._"

    return None  # No transformation


async def on_memory_flush(ctx: SkillContext) -> None:
    """Called before the memory system compacts/flushes.

    Use this to save any in-memory state that should survive compaction.

    Demonstrates: memory.write, get_state, log
    """
    ctx.log("kitchen-sink: on_memory_flush — persisting volatile state")

    state = ctx.get_state() or {}
    notes_index = state.get("notes_index", [])

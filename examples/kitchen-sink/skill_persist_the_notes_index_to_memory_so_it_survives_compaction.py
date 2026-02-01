from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Persist the notes index to memory so it survives compaction"""

    # Persist the notes index to memory so it survives compaction
    if notes_index:
        await ctx.memory.write(
            "kitchen-sink/notes-index",
            json.dumps(notes_index),
        )


async def on_tick(ctx: SkillContext) -> None:
    """Called periodically at the configured tick_interval (60 seconds).

    Use this for background tasks: polling APIs, syncing data,
    generating summaries, cleaning up stale data.

    Demonstrates: get_state, set_state, memory.list, log, emit_event
    """
    state = ctx.get_state() or {}
    tick_count = state.get("tick_count", 0) + 1
    ctx.set_state({"tick_count": tick_count, "last_tick": _now()})

    ctx.log(f"kitchen-sink: tick #{tick_count}")

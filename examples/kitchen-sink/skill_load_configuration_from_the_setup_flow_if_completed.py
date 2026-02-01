from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Load configuration from the setup flow (if completed)"""

    # Load configuration from the setup flow (if completed)
    try:
        raw = await ctx.read_data("config.json")
        config = json.loads(raw)
        ctx.set_state({"config": config, "loaded_at": _now()})
        ctx.log(f"kitchen-sink: loaded config for user '{config.get('username')}'")
    except Exception:
        ctx.set_state({"config": None, "loaded_at": _now()})
        ctx.log("kitchen-sink: no config found (setup not completed)")

    # Initialize notes index if not present
    state = ctx.get_state() or {}
    if "notes_index" not in state:
        ctx.set_state({"notes_index": []})


async def on_unload(ctx: SkillContext) -> None:
    """Called once when the skill is unloaded at app shutdown.

    Use this to clean up resources, flush buffers, close connections.

    Demonstrates: log, set_state
    """
    ctx.log("kitchen-sink: on_unload — cleaning up")
    ctx.set_state({"unloaded_at": _now()})


async def on_session_start(ctx: SkillContext, session_id: str) -> None:
    """Called when a new conversation session begins.

    Use this to initialize session-scoped state, greet the user, or
    load session-specific context.

    Demonstrates: session.set, log
    """
    ctx.log(f"kitchen-sink: session started — {session_id}")
    ctx.session.set("message_count", 0)
    ctx.session.set("session_started_at", _now())


async def on_session_end(ctx: SkillContext, session_id: str) -> None:
    """Called when a conversation session ends.

    Use this to persist session summaries, flush analytics, etc.

    Demonstrates: session.get, memory.write, log
    """
    message_count = ctx.session.get("message_count") or 0
    started_at = ctx.session.get("session_started_at") or "unknown"

    ctx.log(
        f"kitchen-sink: session ended — {session_id} ({message_count} messages since {started_at})"
    )

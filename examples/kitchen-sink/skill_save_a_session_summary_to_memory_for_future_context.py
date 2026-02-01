from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Save a session summary to memory for future context"""

    # Save a session summary to memory for future context
    if message_count > 0:
        await ctx.memory.write(
            f"session-summary/{session_id}",
            json.dumps(
                {
                    "session_id": session_id,
                    "message_count": message_count,
                    "started_at": started_at,
                    "ended_at": _now(),
                }
            ),
        )


async def on_before_message(ctx: SkillContext, message: str) -> str | None:
    """Called before each user message is sent to the AI.

    Return a string to transform/augment the message.
    Return None to pass it through unchanged.

    Demonstrates: session.get/set, get_state, message transformation
    """
    # Track message count in session
    count = (ctx.session.get("message_count") or 0) + 1
    ctx.session.set("message_count", count)

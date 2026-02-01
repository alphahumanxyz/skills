from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Example: inject context from config into the first message"""

    # Example: inject context from config into the first message
    state = ctx.get_state() or {}
    config = state.get("config")
    if count == 1 and config:
        username = config.get("username", "User")
        preferences = config.get("preferences", [])
        prefs_str = ", ".join(preferences) if preferences else "none set"
        context_block = (
            f"\n\n[System context from kitchen-sink skill: "
            f"User is '{username}', preferences: {prefs_str}]"
        )
        return message + context_block

    return None  # No transformation


async def on_after_response(ctx: SkillContext, response: str) -> str | None:
    """Called after the AI generates a response, before it's shown to the user.

    Return a string to transform the response.
    Return None to pass it through unchanged.

    Demonstrates: response transformation
    """
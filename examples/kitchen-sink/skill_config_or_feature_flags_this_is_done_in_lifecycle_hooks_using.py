from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: config or feature flags. This is done in lifecycle hooks using"""

# config or feature flags. This is done in lifecycle hooks using
# ctx.tools.register() and ctx.tools.unregister().


async def execute_dynamic_tool(args: dict) -> ToolResult:
    """A tool registered dynamically at runtime."""
    ctx: SkillContext = args.pop("__context__")
    state = ctx.get_state() or {}
    config = state.get("config", {})
    username = config.get("username", "User")
    return ToolResult(content=f"Hello {username}! This tool was registered dynamically.")


async def _register_dynamic_tools(ctx: SkillContext) -> None:
    """Register tools based on config (called from on_load)."""
    state = ctx.get_state() or {}
    config = state.get("config")

    if not config:
        return

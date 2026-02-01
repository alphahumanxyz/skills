from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: ==========================================================================="""

# ===========================================================================

skill = SkillDefinition(
    name="kitchen-sink",
    description=(
        "Comprehensive example skill demonstrating every capability: "
        "lifecycle hooks, tools, setup flow, state, memory, entities, "
        "events, and periodic tasks."
    ),
    version="1.0.0",
    tools=TOOLS,
    tick_interval=60_000,  # 60 seconds, in milliseconds
    has_setup=True,
    hooks=SkillHooks(
        on_load=on_load,
        on_unload=on_unload,
        on_session_start=on_session_start,
        on_session_end=on_session_end,
        on_before_message=on_before_message,
        on_after_response=on_after_response,
        on_memory_flush=on_memory_flush,
        on_tick=on_tick,
        on_setup_start=on_setup_start,
        on_setup_submit=on_setup_submit,
        on_setup_cancel=on_setup_cancel,
    ),
)
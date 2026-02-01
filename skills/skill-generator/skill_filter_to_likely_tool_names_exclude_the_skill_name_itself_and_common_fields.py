from __future__ import annotations
from dev.types.skill_types import SkillDefinition, SkillContext, SkillHooks, SkillTool, ToolDefinition, ToolResult
import json
import logging
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
"""Section: Filter to likely tool names (exclude the skill name itself and common fields)"""

    # Filter to likely tool names (exclude the skill name itself and common fields)
    info["tool_names"] = [
        n
        for n in tool_names
        if n != info.get("name") and n not in ("on_load", "on_unload", "on_tick")
    ]

    # Find defined hooks
    hooks_found = []
    for hook in (
        "on_load",
        "on_unload",
        "on_session_start",
        "on_session_end",
        "on_before_message",
        "on_after_response",
        "on_tick",
    ):
        if re.search(rf"{hook}\s*=\s*\w", content):
            hooks_found.append(hook)
    info["hooks"] = hooks_found

    return info


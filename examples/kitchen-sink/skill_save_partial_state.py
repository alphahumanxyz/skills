from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: --- Save partial state ---"""

    # --- Save partial state ---
    ctx.set_state(
        {
            "setup_partial": {
                "username": username,
                "experience": experience,
                "preferences": preferences,
            }
        }
    )

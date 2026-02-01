from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Example: register an extra tool only for advanced/degen users"""

    # Example: register an extra tool only for advanced/degen users
    if config.get("experience") in ("advanced", "degen"):
        ctx.tools.register(
            SkillTool(
                definition=ToolDefinition(
                    name="advanced_analytics",
                    description="Run advanced on-chain analytics (advanced users only).",
                    parameters={
                        "type": "object",
                        "properties": {
                            "protocol": {
                                "type": "string",
                                "description": "Protocol to analyze",
                            },
                        },
                        "required": ["protocol"],
                    },
                ),
                execute=execute_dynamic_tool,
            )
        )
        ctx.log("kitchen-sink: registered advanced_analytics tool")


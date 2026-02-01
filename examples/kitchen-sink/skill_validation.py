from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: --- Validation ---"""

    # --- Validation ---
    if alert_threshold is not None:
        try:
            alert_threshold = float(alert_threshold)
            if alert_threshold < 0 or alert_threshold > 100:
                return SetupResult(
                    status="error",
                    errors=[
                        SetupFieldError(
                            field="alert_threshold",
                            message="Threshold must be between 0 and 100.",
                        )
                    ],
                )
        except (ValueError, TypeError):
            return SetupResult(
                status="error",
                errors=[
                    SetupFieldError(
                        field="alert_threshold",
                        message="Must be a valid number.",
                    )
                ],
            )

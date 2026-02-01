from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: --- Advance to next step ---"""

    # --- Advance to next step ---
    return SetupResult(
        status="next",
        next_step=SetupStep(
            id="notifications",
            title="Notification Preferences",
            description="Configure how you'd like to receive updates.",
            fields=[
                SetupField(
                    name="enable_notifications",
                    type="boolean",
                    label="Enable Notifications",
                    description="Receive alerts for important events.",
                    default=True,
                ),
                SetupField(
                    name="digest_frequency",
                    type="select",
                    label="Digest Frequency",
                    description="How often to receive summary digests.",
                    options=[
                        SetupFieldOption(label="Every hour", value="hourly"),
                        SetupFieldOption(label="Daily", value="daily"),
                        SetupFieldOption(label="Weekly", value="weekly"),
                        SetupFieldOption(label="Never", value="never"),
                    ],
                    default="daily",
                ),
                SetupField(
                    name="alert_threshold",
                    type="number",
                    label="Price Alert Threshold (%)",
                    description="Minimum percentage change to trigger a price alert.",
                    placeholder="e.g. 5",
                    default=5,
                    required=False,
                ),
            ],
        ),
    )


async def _handle_notifications_step(ctx: SkillContext, values: dict[str, Any]) -> SetupResult:
    """Validate notifications step and complete setup."""
    enable_notifications = values.get("enable_notifications", True)
    digest_frequency = values.get("digest_frequency", "daily")
    alert_threshold = values.get("alert_threshold", 5)

from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: status="error"    → show field errors, stay on current step"""

#     status="error"    → show field errors, stay on current step
#     status="complete" → setup is done
#   on_setup_cancel → cleanup if user aborts


async def on_setup_start(ctx: SkillContext) -> SetupStep:
    """Return the first step of the setup wizard.

    Demonstrates: SetupStep, SetupField, multiple field types
    """
    return SetupStep(
        id="profile",
        title="Your Profile",
        description="Tell us a bit about yourself to personalize the experience.",
        fields=[
            SetupField(
                name="username",
                type="text",
                label="Display Name",
                description="How should the AI address you?",
                placeholder="e.g. Satoshi",
                required=True,
            ),
            SetupField(
                name="experience",
                type="select",
                label="Crypto Experience",
                description="Your level of experience in crypto.",
                options=[
                    SetupFieldOption(label="Beginner", value="beginner"),
                    SetupFieldOption(label="Intermediate", value="intermediate"),
                    SetupFieldOption(label="Advanced", value="advanced"),
                    SetupFieldOption(label="Degen", value="degen"),
                ],
                required=True,
            ),
            SetupField(
                name="preferences",
                type="multiselect",
                label="Interests",
                description="Select topics you're interested in.",
                options=[
                    SetupFieldOption(label="DeFi", value="defi"),
                    SetupFieldOption(label="NFTs", value="nfts"),
                    SetupFieldOption(label="Trading", value="trading"),
                    SetupFieldOption(label="Development", value="development"),
                    SetupFieldOption(label="Research", value="research"),
                    SetupFieldOption(label="Governance", value="governance"),
                ],
                required=False,
                default=[],
            ),
        ],
    )


async def on_setup_submit(ctx: SkillContext, step_id: str, values: dict[str, Any]) -> SetupResult:
    """Handle form submission for each setup step.

    Demonstrates: validation, multi-step flow, data persistence, SetupResult
    """
    if step_id == "profile":
        return await _handle_profile_step(ctx, values)
    elif step_id == "notifications":
        return await _handle_notifications_step(ctx, values)
    else:
        return SetupResult(
            status="error",
            errors=[SetupFieldError(field="", message=f"Unknown step: {step_id}")],
        )


async def on_setup_cancel(ctx: SkillContext) -> None:
    """Handle user cancellation of the setup wizard.

    Demonstrates: cleanup of partial setup state
    """
    ctx.log("kitchen-sink: setup cancelled — cleaning up partial state")
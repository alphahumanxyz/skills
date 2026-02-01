from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: --- Merge with profile data and persist ---"""

    # --- Merge with profile data and persist ---
    state = ctx.get_state() or {}
    partial = state.get("setup_partial", {})

    config = {
        **partial,
        "enable_notifications": enable_notifications,
        "digest_frequency": digest_frequency,
        "alert_threshold": alert_threshold,
        "setup_completed_at": _now(),
    }

    # Persist config to data directory
    await ctx.write_data("config.json", json.dumps(config, indent=2))

    # Update skill state
    ctx.set_state({"config": config, "setup_partial": None})

    # Emit setup complete event
    ctx.emit_event("setup_completed", {"username": config.get("username")})

    ctx.log(f"kitchen-sink: setup completed for '{config.get('username')}'")

    return SetupResult(
        status="complete",
        message=(
            f"All set, {config['username']}! "
            f"Your preferences have been saved. "
            f"You'll receive {digest_frequency} digests."
        ),
    )


from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: on_setup_submit(step_id, values) → returns SetupResult"""

#   on_setup_submit(step_id, values) → returns SetupResult
#     status="next"     → show next_step
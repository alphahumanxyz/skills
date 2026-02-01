from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: Skills with has_setup=True define a multi-step wizard that the host"""

# Skills with has_setup=True define a multi-step wizard that the host
# renders as a form UI. The flow:
#   on_setup_start → returns first SetupStep
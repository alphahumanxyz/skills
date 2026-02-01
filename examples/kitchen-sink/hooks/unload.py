"""
Unload hook — cleanup on shutdown.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
  from dev.types.skill_types import SkillContext


def _now() -> str:
  """Get current timestamp."""
  return datetime.now(UTC).isoformat()


async def on_unload(ctx: SkillContext) -> None:
  """Called once when the skill is unloaded at app shutdown.

  Use this to clean up resources, flush buffers, close connections.

  Demonstrates: log, set_state
  """
  ctx.log("kitchen-sink: on_unload — cleaning up")
  ctx.set_state({"unloaded_at": _now()})

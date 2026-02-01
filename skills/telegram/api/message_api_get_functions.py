from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import Message
from telethon.tl.functions.messages import GetHistoryRequest
import logging
import random
from dataclasses import dataclass
from typing import Any, TypeVar, Generic
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit

"""Section: get_functions"""

async def get_drafts() -> ApiResult[list[Any]]:
    """Get all drafts."""
    try:
        await enforce_rate_limit("api_read")

        mtproto = get_client()
        client = mtproto.get_client()

        result = await mtproto.with_flood_wait_handling(lambda: client(GetAllDraftsRequest()))

        updates = getattr(result, "updates", [])
        log.debug("Fetched all drafts")
        return ApiResult(data=updates, from_cache=False)
    except Exception:
        log.exception("Error fetching drafts")
        return ApiResult(data=[], from_cache=False)
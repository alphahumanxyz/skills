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

"""Section: clear_functions"""

async def clear_draft(chat_id: str) -> dict[str, bool]:
    """Clear draft in a chat."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        await mtproto.with_flood_wait_handling(
            lambda: client(
                SaveDraftRequest(
                    peer=entity,
                    message="",
                )
            )
        )

        log.debug("Cleared draft in chat %s", chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error clearing draft in chat %s", chat_id)
        return {"success": False}
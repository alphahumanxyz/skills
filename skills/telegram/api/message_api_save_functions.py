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

"""Section: save_functions"""

async def save_draft(
    chat_id: str,
    text: str,
    reply_to_msg_id: int | None = None,
) -> dict[str, bool]:
    """Save a draft message."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        kwargs: dict[str, Any] = {"peer": entity, "message": text}
        if reply_to_msg_id:
            kwargs["reply_to"] = InputReplyToMessage(reply_to_msg_id=reply_to_msg_id)

        await mtproto.with_flood_wait_handling(lambda: client(SaveDraftRequest(**kwargs)))

        log.debug("Saved draft in chat %s", chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error saving draft in chat %s", chat_id)
        return {"success": False}
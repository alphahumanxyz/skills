from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import Message
from telethon.tl.functions.messages import GetHistoryRequest
from telethon.tl.functions.messages import EditMessageRequest
import logging
import random
from dataclasses import dataclass
from typing import Any, TypeVar, Generic
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit

"""Section: edit_functions"""

async def edit_message(
    chat_id: str | int,
    message_id: int,
    new_text: str,
) -> dict[str, bool]:
    """Edit an existing message."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        await mtproto.with_flood_wait_handling(
            lambda: client(
                EditMessageRequest(
                    peer=entity,
                    id=message_id,
                    message=new_text,
                )
            )
        )

        log.debug("Edited message %d in chat %s", message_id, chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error editing message %d in chat %s", message_id, chat_id)
        return {"success": False}
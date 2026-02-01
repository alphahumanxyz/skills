from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import Message
from telethon.tl.functions.messages import GetHistoryRequest
from telethon.tl.functions.messages import UpdatePinnedMessageRequest
import logging
import random
from dataclasses import dataclass
from typing import Any, TypeVar, Generic
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit

"""Section: unpin_functions"""

async def unpin_message(
    chat_id: str,
    message_id: int,
) -> dict[str, bool]:
    """Unpin a message in a chat."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        await mtproto.with_flood_wait_handling(
            lambda: client(
                UpdatePinnedMessageRequest(
                    peer=entity,
                    id=message_id,
                    unpin=True,
                )
            )
        )

        log.debug("Unpinned message %d in chat %s", message_id, chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error unpinning message %d in chat %s", message_id, chat_id)
        return {"success": False}
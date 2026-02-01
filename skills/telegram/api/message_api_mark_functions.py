from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import Message
from telethon.tl.functions.messages import GetHistoryRequest
from telethon.tl.functions.messages import ReadHistoryRequest
import logging
import random
from dataclasses import dataclass
from typing import Any, TypeVar, Generic
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit

"""Section: mark_functions"""

async def mark_as_read(chat_id: str) -> dict[str, bool]:
    """Mark messages as read in a chat."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)
        chat = store.get_chat_by_id(chat_id)

        is_channel = chat and chat.type in ("channel", "supergroup")

        if is_channel and isinstance(entity, InputChannel):
            await mtproto.with_flood_wait_handling(
                lambda: client(
                    ChannelReadHistoryRequest(
                        channel=entity,
                        max_id=0,
                    )
                )
            )
        else:
            await mtproto.with_flood_wait_handling(
                lambda: client(
                    ReadHistoryRequest(
                        peer=entity,
                        max_id=0,
                    )
                )
            )

        log.debug("Marked messages as read in chat %s", chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error marking messages as read in chat %s", chat_id)
        return {"success": False}
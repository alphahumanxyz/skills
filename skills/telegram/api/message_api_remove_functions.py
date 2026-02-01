from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import ReactionEmoji
from telethon.tl.functions.messages import SendReactionRequest
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

"""Section: remove_functions"""

async def remove_reaction(
    chat_id: str,
    message_id: int,
    reaction: str | None = None,
) -> dict[str, bool]:
    """Remove a reaction from a message."""
    try:
        await enforce_rate_limit("api_write")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        await mtproto.with_flood_wait_handling(
            lambda: client(
                SendReactionRequest(
                    peer=entity,
                    msg_id=message_id,
                    reaction=[],
                )
            )
        )

        log.debug("Removed reaction from message %d in chat %s", message_id, chat_id)
        return {"success": True}
    except Exception:
        log.exception("Error removing reaction from message %d in chat %s", message_id, chat_id)
        return {"success": False}
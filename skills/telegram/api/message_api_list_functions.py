from __future__ import annotations
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit
from telethon.tl.types import Message
from telethon.tl.functions.messages import GetHistoryRequest
from telethon.tl.functions.channels import GetForumTopicsRequest
import logging
import random
from dataclasses import dataclass
from typing import Any, TypeVar, Generic
from ..client.telethon_client import get_client
from ..client.builders import build_message
from ..state import store
from ..state.types import TelegramMessage
from ..helpers import enforce_rate_limit

"""Section: list_functions"""

async def list_topics(chat_id: str) -> ApiResult[list[Any]]:
    """List topics in a forum/supergroup."""
    try:
        await enforce_rate_limit("api_read")

        mtproto = get_client()
        client = mtproto.get_client()
        entity = await client.get_input_entity(chat_id)

        if not isinstance(entity, InputChannel):
            log.debug("Chat %s is not a channel/supergroup", chat_id)
            return ApiResult(data=[], from_cache=False)

        if GetForumTopicsRequest is None:
            log.debug("GetForumTopicsRequest not available in this telethon version")
            return ApiResult(data=[], from_cache=False)

        result = await mtproto.with_flood_wait_handling(
            lambda: client(
                GetForumTopicsRequest(
                    channel=entity,
                    offset_date=0,
                    offset_id=0,
                    offset_topic=0,
                    limit=100,
                )
            )
        )

        topics = getattr(result, "topics", [])
        log.debug("Fetched %d topics from chat %s", len(topics), chat_id)
        return ApiResult(data=topics, from_cache=False)
    except Exception:
        log.exception("Error fetching topics from chat %s", chat_id)
        return ApiResult(data=[], from_cache=False)
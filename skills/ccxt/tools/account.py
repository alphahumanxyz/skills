"""
Account and exchange management tools.
"""

from __future__ import annotations

from mcp.types import Tool

account_tools: list[Tool] = [
    Tool(
        name="list_exchanges",
        description="List all configured exchange connections",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="get_exchange_info",
        description="Get information about a specific exchange connection",
        inputSchema={
            "type": "object",
            "properties": {
                "exchange_id": {
                    "type": "string",
                    "description": "The exchange connection ID",
                },
            },
            "required": ["exchange_id"],
        },
    ),
    Tool(
        name="test_connection",
        description="Test connection to an exchange",
        inputSchema={
            "type": "object",
            "properties": {
                "exchange_id": {
                    "type": "string",
                    "description": "The exchange connection ID",
                },
            },
            "required": ["exchange_id"],
        },
    ),
    Tool(
        name="get_available_exchanges",
        description="List all available CCXT exchange names",
        inputSchema={"type": "object", "properties": {}},
    ),
]

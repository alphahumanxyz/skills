#!/usr/bin/env python3
"""
Gas Estimator — Python subprocess skill example.

Implements the AlphaHuman JSON-RPC 2.0 skill protocol over stdin/stdout.

EXPERIMENTAL: The subprocess runtime is not yet built into AlphaHuman.
This example demonstrates the planned protocol.

Test manually:
    python3 skill.py
    # Then paste JSON-RPC requests into stdin
"""

import json
import sys

# ---------------------------------------------------------------------------
# Skill metadata
# ---------------------------------------------------------------------------

SKILL_NAME = "gas-estimate"
SKILL_DESCRIPTION = "Estimate gas costs for common blockchain operations"
SKILL_VERSION = "1.0.0"

TOOLS = [
    {
        "name": "gas_estimate",
        "description": "Estimate gas cost for a blockchain operation",
        "parameters": {
            "type": "object",
            "properties": {
                "chain": {
                    "type": "string",
                    "description": "Blockchain name (ethereum, arbitrum, base, optimism, bsc)",
                },
                "operation": {
                    "type": "string",
                    "description": "Operation type (transfer, swap, approve, mint, bridge)",
                },
            },
            "required": ["chain"],
        },
    }
]

# ---------------------------------------------------------------------------
# Gas estimation logic
# ---------------------------------------------------------------------------

# Approximate gas units per operation
GAS_UNITS = {
    "transfer": 21_000,
    "approve": 46_000,
    "swap": 150_000,
    "mint": 200_000,
    "bridge": 120_000,
}

# Approximate gas prices in Gwei (illustrative, not real-time)
GAS_PRICES_GWEI = {
    "ethereum": 25.0,
    "arbitrum": 0.1,
    "base": 0.05,
    "optimism": 0.08,
    "bsc": 3.0,
}

# Approximate native token prices in USD (illustrative)
TOKEN_PRICES_USD = {
    "ethereum": 3400.0,
    "arbitrum": 3400.0,  # ETH
    "base": 3400.0,  # ETH
    "optimism": 3400.0,  # ETH
    "bsc": 600.0,  # BNB
}


def estimate_gas(chain: str, operation: str = "transfer") -> dict:
    chain = chain.lower()
    operation = operation.lower()

    if chain not in GAS_PRICES_GWEI:
        return {
            "content": f"Unknown chain: {chain}. Supported: {', '.join(GAS_PRICES_GWEI.keys())}",
            "isError": True,
        }

    if operation not in GAS_UNITS:
        return {
            "content": f"Unknown operation: {operation}. Supported: {', '.join(GAS_UNITS.keys())}",
            "isError": True,
        }

    gas_units = GAS_UNITS[operation]
    gas_price_gwei = GAS_PRICES_GWEI[chain]
    token_price = TOKEN_PRICES_USD[chain]

    # Cost in native token
    cost_native = (gas_units * gas_price_gwei) / 1e9
    cost_usd = cost_native * token_price

    token_name = "BNB" if chain == "bsc" else "ETH"

    lines = [
        f"Gas Estimate: {operation} on {chain}",
        f"",
        f"Gas units:  {gas_units:,}",
        f"Gas price:  {gas_price_gwei} Gwei",
        f"Cost:       {cost_native:.6f} {token_name} (~${cost_usd:.2f})",
        f"",
        f"Note: These are approximate estimates. Actual costs vary with network conditions.",
    ]

    return {"content": "\n".join(lines)}


# ---------------------------------------------------------------------------
# JSON-RPC handler
# ---------------------------------------------------------------------------


def handle_request(request: dict) -> dict:
    method = request.get("method", "")
    params = request.get("params", {})
    req_id = request.get("id")

    if method == "initialize":
        result = {
            "name": SKILL_NAME,
            "description": SKILL_DESCRIPTION,
            "version": SKILL_VERSION,
            "tools": TOOLS,
        }
        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        if tool_name == "gas_estimate":
            result = estimate_gas(
                chain=arguments.get("chain", "ethereum"),
                operation=arguments.get("operation", "transfer"),
            )
        else:
            result = {"content": f"Unknown tool: {tool_name}", "isError": True}

        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    elif method.startswith("lifecycle/"):
        # Acknowledge lifecycle events
        return {"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}

    elif method == "shutdown":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"ok": True}}

    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {e}"},
            }
            print(json.dumps(response), flush=True)
            continue

        response = handle_request(request)
        print(json.dumps(response), flush=True)

        # Exit after shutdown
        if request.get("method") == "shutdown":
            break


if __name__ == "__main__":
    main()

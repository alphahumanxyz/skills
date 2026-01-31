---
name: gas-estimate
description: Estimate gas costs for common Ethereum operations across chains.
---

# Gas Estimator (Python)

## Overview

Estimate gas costs for common blockchain operations using the `gas_estimate` tool. This is an example of a Python subprocess skill.

## When to Use

Activate this skill when the user asks about gas costs for specific operations on specific chains.

## Instructions

1. Use the `gas_estimate` tool with the chain name and operation type.
2. Present the estimate clearly with USD cost.

## Limitations

- Uses hardcoded gas unit estimates (not live data)
- Gas prices are illustrative, not real-time
- This is an EXPERIMENTAL example — the Python runtime is not yet available

---
name: gas-optimizer
description: Suggest optimal gas strategies and timing for Ethereum transactions.
---

# Gas Optimizer

## Overview

Help users save on Ethereum gas fees by suggesting optimal transaction timing, gas price strategies, and L2 alternatives.

## When to Use

Activate this skill when the user:
- Asks about gas prices or gas fees
- Wants to know the best time to transact
- Asks about L2 alternatives for cheaper transactions
- Mentions "gas is expensive" or similar complaints
- Is about to make a large transaction and wants to optimize cost

## Instructions

1. **Check current gas prices** — Search for current Ethereum gas prices (Gwei).
2. **Analyze the request** — Determine if the user needs immediate execution or can wait.
3. **Recommend strategy**:
   - **Urgent**: Use current gas price, suggest EIP-1559 parameters
   - **Can wait**: Suggest off-peak hours (typically weekends, early morning UTC)
   - **Cost-sensitive**: Recommend L2 alternatives (Arbitrum, Optimism, Base)
4. **Provide context** — Explain gas units, Gwei, and how priority fees work if the user seems unfamiliar.

## Output Format

```
## Gas Report

Current gas: XX Gwei (base) + X Gwei (priority)
Network status: [Low/Medium/High congestion]

### Recommendation
[Strategy based on user's needs]

### L2 Alternatives
| Chain | Est. Cost | Savings |
|-------|-----------|---------|
| Arbitrum | $X.XX | ~XX% |
| Base | $X.XX | ~XX% |
```

## Examples

### Example 1: Current Gas

**User**: What's gas at right now?
**Agent**: Current Ethereum gas: ~25 Gwei (base) + 1 Gwei (priority). Network is moderately congested. A standard transfer would cost ~$2.50, a Uniswap swap ~$15-25. If you can wait, gas typically drops to 15-18 Gwei on weekends.

## Limitations

- Gas data is fetched via web search (not real-time)
- Predictions are based on historical patterns, not guaranteed
- L2 gas estimates are approximate

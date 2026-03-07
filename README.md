# @pepo_fun/hidooor-mcp

Private token swaps on Solana, directly from your AI assistant.

[Hidooor](https://hidooor.pepo.fun) breaks the on-chain link between your input SOL and output tokens using a privacy pool, so swaps can't be traced back to your wallet.

## Quick Start

```bash
claude mcp add hidooor npx @pepo_fun/hidooor-mcp@latest
```

Or add manually to your MCP client config:

```json
{
  "mcpServers": {
    "hidooor": {
      "command": "npx",
      "args": ["@pepo_fun/hidooor-mcp@latest"],
      "env": {
        "HIDOOOR_API_URL": "https://hidooor-production.up.railway.app"
      }
    }
  }
}
```

## Modes

| Mode | When | What you can do |
|------|------|-----------------|
| **READ_ONLY** | No `SOLANA_PRIVATE_KEY` set | Quotes, token search, order status |
| **FULL** | `SOLANA_PRIVATE_KEY` is set | Everything above + execute swaps |

## Tools

| Tool | Description | Mode |
|------|-------------|------|
| `hidooor_tokens_search` | Search swappable tokens by name or symbol | READ_ONLY |
| `hidooor_tokens_popular` | Get popular tokens (USDC, BONK, JUP, etc.) | READ_ONLY |
| `hidooor_get_quote` | Get swap quote with full fee breakdown | READ_ONLY |
| `hidooor_get_minimum_amount` | Minimum SOL required for a private swap | READ_ONLY |
| `hidooor_get_deposit_address` | Get deterministic derived deposit address | READ_ONLY |
| `hidooor_order_status` | Check swap order status by ID | READ_ONLY |
| `hidooor_user_orders` | List recent orders for a wallet | READ_ONLY |
| `hidooor_execute_swap` | Execute a full private swap | FULL |

## Example

```
You: "Privately swap 0.1 SOL to BONK"

Claude:
  1. hidooor_get_quote → 0.1 SOL = 1,245,000 BONK (fees: 0.008 SOL)
  2. hidooor_execute_swap → sends SOL, starts privacy flow
  3. Returns orderId → poll with hidooor_order_status
  4. Done. Tokens arrive in your wallet with no on-chain link.
```

## How It Works

```
Your Wallet ──SOL──> Derived Address ──> Privacy Pool ──> Service Wallet ──> Jupiter ──> Your Wallet
                                              |
                                     (breaks on-chain link)
```

1. SOL is sent to a deterministic derived address
2. Deposited into a ZK privacy pool (link broken here)
3. Withdrawn to a service wallet
4. Swapped via Jupiter to your target token
5. Tokens sent to your original wallet

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HIDOOOR_API_URL` | `https://hidooor-production.up.railway.app` | Backend API URL |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLANA_PRIVATE_KEY` | — | Base58 private key (enables FULL mode) |
| `MCP_MAX_SWAP_SOL` | `1` | Max SOL per swap (safety limit) |
| `MCP_REQUIRE_CONFIRM` | `true` | Require `confirm: true` for spend actions |
| `MCP_TX_COMMITMENT` | `confirmed` | Transaction confirmation level |
| `MCP_LOG_SENSITIVE` | `false` | Log wallet addresses and tx IDs (off by default) |

### Full mode example

```json
{
  "mcpServers": {
    "hidooor": {
      "command": "npx",
      "args": ["@pepo_fun/hidooor-mcp@latest"],
      "env": {
        "HIDOOOR_API_URL": "https://hidooor-production.up.railway.app",
        "SOLANA_PRIVATE_KEY": "your_base58_private_key",
        "MCP_MAX_SWAP_SOL": "2",
        "MCP_REQUIRE_CONFIRM": "true"
      }
    }
  }
}
```

## Safety

- **confirm=true required** — spend tools reject unless explicitly confirmed
- **Max amount limit** — configurable cap per swap (default 1 SOL)
- **Balance check** — verifies funds before sending
- **Log redaction** — wallet addresses, tx IDs, and keys are redacted by default
- **No admin endpoints** — MCP never touches admin/recovery APIs
- **Partial failure handling** — if funds are sent but processing fails, returns tx details and recovery instructions

## Works With

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `claude mcp add hidooor npx @pepo_fun/hidooor-mcp@latest`
- [Claude Desktop](https://claude.ai/download) — add to `claude_desktop_config.json`
- [Cursor](https://cursor.com) — add to MCP settings
- Any MCP-compatible AI assistant

## Development

```bash
git clone https://github.com/pepo-fun/hidooor-mcp.git
cd hidooor-mcp
npm install
npm run build
npm test
```

## Resources

- [Hidooor](https://hidooor.pepo.fun)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)

## License

[MIT](LICENSE)

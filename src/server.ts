import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BackendClient } from './backend-client.js';
import { McpConfig } from './config.js';
import { executeSwapFlow } from './flow.js';
import { logError, logInfo } from './logger.js';
import { RateLimiter } from './rate-limiter.js';
import { SolanaSigner } from './solana-signer.js';
import { ToolResult } from './types.js';
import { createTraceId, formatToolText } from './utils.js';
import { BASE58_ADDRESS_REGEX, MIN_SWAP_SOL } from './validation.js';

const toContent = (result: ToolResult) => ({
  content: [{ type: 'text' as const, text: formatToolText(result) }],
});

export const createMcpServer = (config: McpConfig): McpServer => {
  const client = new BackendClient(config);
  const signer = config.keypair
    ? new SolanaSigner(config.solanaRpcUrl, config.keypair, config.txCommitment)
    : undefined;

  const swapLimiter = new RateLimiter(5, 60_000);

  const server = new McpServer({
    name: 'hidooor',
    version: '1.0.1',
  });

  server.tool(
    'hidooor_tokens_search',
    'Search swappable Solana tokens on Hidooor.',
    {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(20).optional(),
    },
    async ({ query, limit }) => {
      const traceId = createTraceId();
      try {
        const data = await client.searchTokens(query, limit ?? 10);
        const result: ToolResult = { success: true, mode: config.mode, traceId, data };
        return toContent(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError('tokens_search_failed', { traceId, message });
        return toContent({
          success: false,
          mode: config.mode,
          traceId,
          error: { code: 'PROCESS_FAILED', message },
        });
      }
    }
  );

  server.tool('hidooor_tokens_popular', 'Get popular swappable tokens.', {}, async () => {
    const traceId = createTraceId();
    try {
      const data = await client.popularTokens();
      return toContent({ success: true, mode: config.mode, traceId, data });
    } catch (error) {
      return toContent({
        success: false,
        mode: config.mode,
        traceId,
        error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  server.tool(
    'hidooor_get_quote',
    'Get private swap quote for SOL to output token.',
    {
      outputMint: z.string().regex(BASE58_ADDRESS_REGEX),
      amountSol: z.number().positive().gte(MIN_SWAP_SOL),
    },
    async ({ outputMint, amountSol }) => {
      const traceId = createTraceId();
      try {
        const amountLamports = SolanaSigner.solToLamports(amountSol);
        const quote = await client.getQuote(outputMint, amountLamports);
        return toContent({ success: true, mode: config.mode, traceId, data: quote });
      } catch (error) {
        return toContent({
          success: false,
          mode: config.mode,
          traceId,
          error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  );

  server.tool('hidooor_get_minimum_amount', 'Get minimum SOL amount required for private swap.', {}, async () => {
    const traceId = createTraceId();
    try {
      const data = await client.getMinimumAmount();
      return toContent({ success: true, mode: config.mode, traceId, data });
    } catch (error) {
      return toContent({
        success: false,
        mode: config.mode,
        traceId,
        error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  server.tool(
    'hidooor_get_deposit_address',
    'Get deterministic derived deposit address for a wallet.',
    { walletAddress: z.string().regex(BASE58_ADDRESS_REGEX) },
    async ({ walletAddress }) => {
      const traceId = createTraceId();
      try {
        const data = await client.getDerivedAddress(walletAddress);
        return toContent({ success: true, mode: config.mode, traceId, data });
      } catch (error) {
        return toContent({
          success: false,
          mode: config.mode,
          traceId,
          error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  );

  server.tool('hidooor_order_status', 'Get swap order status by ID.', { orderId: z.string().uuid() }, async ({ orderId }) => {
    const traceId = createTraceId();
    try {
      const data = await client.getOrderStatus(orderId);
      return toContent({ success: true, mode: config.mode, traceId, data });
    } catch (error) {
      return toContent({
        success: false,
        mode: config.mode,
        traceId,
        error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  server.tool(
    'hidooor_user_orders',
    'Get recent orders for a wallet address.',
    { walletAddress: z.string().regex(BASE58_ADDRESS_REGEX) },
    async ({ walletAddress }) => {
      const traceId = createTraceId();
      try {
        const data = await client.getUserOrders(walletAddress);
        return toContent({ success: true, mode: config.mode, traceId, data });
      } catch (error) {
        return toContent({
          success: false,
          mode: config.mode,
          traceId,
          error: { code: 'PROCESS_FAILED', message: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  );

  server.tool(
    'hidooor_execute_swap',
    'Execute private SOL->token swap in FULL mode. Transfers SOL to derived address then starts process.',
    {
      outputMint: z.string().regex(BASE58_ADDRESS_REGEX),
      amountSol: z.number().positive().gte(MIN_SWAP_SOL),
      confirm: z.boolean().default(false),
      idempotencyKey: z.string().uuid().optional(),
    },
    async (args) => {
      const traceId = createTraceId();
      logInfo('execute_swap_called', { traceId, mode: config.mode, amountSol: args.amountSol, outputMint: args.outputMint });

      if (!swapLimiter.tryAcquire()) {
        return toContent({
          success: false,
          mode: config.mode,
          traceId,
          error: { code: 'BACKEND_RATE_LIMIT' as const, message: 'Local rate limit: max 5 swaps per 60 seconds.' },
          nextAction: 'Wait and retry.',
        });
      }

      const result = await executeSwapFlow(config, client, signer, args, traceId);
      return toContent(result);
    }
  );

  return server;
};

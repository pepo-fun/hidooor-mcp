import { randomUUID } from 'crypto';
import { BackendClient } from './backend-client.js';
import { McpConfig } from './config.js';
import { logError, logInfo } from './logger.js';
import { SolanaSigner } from './solana-signer.js';
import { ToolFailure, ToolResult } from './types.js';

export interface ExecuteSwapInput {
  outputMint: string;
  amountSol: number;
  confirm: boolean;
  idempotencyKey?: string;
}

export const toFailure = (
  traceId: string,
  mode: 'READ_ONLY' | 'FULL',
  code: ToolFailure['error']['code'],
  message: string,
  details?: unknown,
  nextAction?: string
): ToolFailure => ({
  success: false,
  mode,
  error: { code, message, details },
  nextAction,
  traceId,
});

const mapError = (traceId: string, mode: 'READ_ONLY' | 'FULL', error: unknown): ToolFailure => {
  const status = (error as Error & { status?: number }).status;
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (status === 429) {
    return toFailure(traceId, mode, 'BACKEND_RATE_LIMIT', message, undefined, 'Retry in ~60 seconds.');
  }

  if (message.toLowerCase().includes('insufficient')) {
    return toFailure(traceId, mode, 'INSUFFICIENT_FUNDS', message);
  }

  return toFailure(traceId, mode, 'PROCESS_FAILED', message);
};

export const executeSwapFlow = async (
  config: McpConfig,
  client: BackendClient,
  signer: SolanaSigner | undefined,
  input: ExecuteSwapInput,
  traceId: string
): Promise<ToolResult> => {
  if (config.mode === 'READ_ONLY' || !signer) {
    return toFailure(
      traceId,
      config.mode,
      'NOT_AVAILABLE_IN_READ_ONLY',
      'Swap execution requires FULL mode.',
      undefined,
      'Configure SOLANA_PRIVATE_KEY or use read-only quote tools.'
    );
  }

  if (config.requireConfirm && input.confirm !== true) {
    return toFailure(
      traceId,
      config.mode,
      'INVALID_INPUT',
      'confirm=true is required for spend actions.',
      undefined,
      'Retry with confirm=true after reviewing quote.'
    );
  }

  if (input.amountSol > config.maxSwapSol) {
    return toFailure(
      traceId,
      config.mode,
      'INVALID_INPUT',
      `amountSol exceeds MCP_MAX_SWAP_SOL (${config.maxSwapSol}).`
    );
  }

  const lamports = SolanaSigner.solToLamports(input.amountSol);
  const wallet = signer.getWalletAddress();

  try {
    const balance = await signer.getBalanceLamports();
    if (balance < lamports) {
      return toFailure(traceId, config.mode, 'INSUFFICIENT_FUNDS', `Wallet balance ${balance} lamports is below ${lamports}.`);
    }

    const quote = await client.getQuote(input.outputMint, lamports);
    const derived = await client.getDerivedAddress(wallet);

    logInfo('swap_transfer_start', { traceId, wallet, lamports, derivedAddress: derived.derivedAddress });
    const transferTxId = await signer.transferSol(derived.derivedAddress, lamports);

    try {
      const auth = await client.getAuthMessage(wallet);
      const signature = signer.signAuthMessage(auth.message);

      const process = await client.processSwap({
        signature,
        message: auth.message,
        publicKey: wallet,
        outputMint: input.outputMint,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      });

      logInfo('swap_process_started', { traceId, wallet, orderId: process.orderId, transferTxId });

      return {
        success: true,
        mode: config.mode,
        txId: transferTxId,
        orderId: process.orderId,
        traceId,
        nextAction: `Poll hidooor_order_status with orderId=${process.orderId}`,
        data: {
          wallet,
          derivedAddress: derived.derivedAddress,
          quotePreview: {
            formattedOutput: quote.formattedOutput,
            totalFees: quote.fees.totalFeesFormatted,
            priceImpact: quote.priceImpact,
          },
          process,
        },
      };
    } catch (processError) {
      const mapped = mapError(traceId, config.mode, processError);
      const message = processError instanceof Error ? processError.message : String(processError);

      logError('swap_process_failed_after_transfer', {
        traceId,
        wallet,
        transferTxId,
        derivedAddress: derived.derivedAddress,
        error: message,
      });

      return {
        ...mapped,
        txId: transferTxId,
        data: {
          wallet,
          derivedAddress: derived.derivedAddress,
          quotePreview: {
            formattedOutput: quote.formattedOutput,
            totalFees: quote.fees.totalFeesFormatted,
            priceImpact: quote.priceImpact,
          },
        },
        error: {
          ...mapped.error,
          details: {
            transferTxId,
            derivedAddress: derived.derivedAddress,
          },
        },
        nextAction:
          'Funds sent to derived address. Call hidooor_order_status or retry process manually.',
      };
    }
  } catch (error) {
    logError('swap_process_failed', { traceId, wallet, error: error instanceof Error ? error.message : String(error) });
    return mapError(traceId, config.mode, error);
  }
};

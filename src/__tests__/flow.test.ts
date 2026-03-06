import { describe, expect, it, vi } from 'vitest';
import { executeSwapFlow } from '../flow.js';
import { McpConfig } from '../config.js';

const readOnlyConfig: McpConfig = {
  apiUrl: 'https://api.test',
  solanaRpcUrl: 'https://rpc.test',
  maxSwapSol: 1,
  requireConfirm: true,
  txCommitment: 'confirmed',
  mode: 'READ_ONLY',
};

const fullConfig: McpConfig = {
  ...readOnlyConfig,
  mode: 'FULL',
};

describe('executeSwapFlow', () => {
  it('blocks spend in read-only mode', async () => {
    const result = await executeSwapFlow(
      readOnlyConfig,
      {} as never,
      undefined,
      { outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amountSol: 0.1, confirm: true },
      'trace-1'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_AVAILABLE_IN_READ_ONLY');
    }
  });

  it('requires confirm flag when enabled', async () => {
    const client = {} as never;
    const signer = {} as never;

    const result = await executeSwapFlow(
      fullConfig,
      client,
      signer,
      { outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amountSol: 0.1, confirm: false },
      'trace-2'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('runs happy path in full mode', async () => {
    const client = {
      getQuote: vi.fn().mockResolvedValue({
        formattedOutput: '10.0',
        priceImpact: '0.1',
        fees: { totalFeesFormatted: '0.01 SOL' },
      }),
      getDerivedAddress: vi.fn().mockResolvedValue({ derivedAddress: 'Derived1111111111111111111111111111111111' }),
      getAuthMessage: vi.fn().mockResolvedValue({ message: 'msg', expiresIn: '5 minutes' }),
      processSwap: vi.fn().mockResolvedValue({ orderId: '00000000-0000-4000-8000-000000000000', status: 'PROCESSING' }),
    } as never;

    const signer = {
      getWalletAddress: vi.fn().mockReturnValue('Wallet111111111111111111111111111111111111'),
      getBalanceLamports: vi.fn().mockResolvedValue(2_000_000_000),
      transferSol: vi.fn().mockResolvedValue('tx-1'),
      signAuthMessage: vi.fn().mockReturnValue('sig-1'),
    } as never;

    const result = await executeSwapFlow(
      fullConfig,
      client,
      signer,
      { outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amountSol: 0.1, confirm: true },
      'trace-3'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.orderId).toBe('00000000-0000-4000-8000-000000000000');
      expect(result.txId).toBe('tx-1');
    }
  });

  it('returns transfer details when process fails after transfer', async () => {
    const client = {
      getQuote: vi.fn().mockResolvedValue({
        formattedOutput: '10.0',
        priceImpact: '0.1',
        fees: { totalFeesFormatted: '0.01 SOL' },
      }),
      getDerivedAddress: vi.fn().mockResolvedValue({ derivedAddress: 'Derived1111111111111111111111111111111111' }),
      getAuthMessage: vi.fn().mockResolvedValue({ message: 'msg', expiresIn: '5 minutes' }),
      processSwap: vi.fn().mockRejectedValue(new Error('backend process unavailable')),
    } as never;

    const signer = {
      getWalletAddress: vi.fn().mockReturnValue('Wallet111111111111111111111111111111111111'),
      getBalanceLamports: vi.fn().mockResolvedValue(2_000_000_000),
      transferSol: vi.fn().mockResolvedValue('tx-transfer'),
      signAuthMessage: vi.fn().mockReturnValue('sig-1'),
    } as never;

    const result = await executeSwapFlow(
      fullConfig,
      client,
      signer,
      { outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amountSol: 0.1, confirm: true },
      'trace-4'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.txId).toBe('tx-transfer');
      expect(result.nextAction).toContain('Funds sent to derived address');
      expect(result.error.details).toEqual({
        transferTxId: 'tx-transfer',
        derivedAddress: 'Derived1111111111111111111111111111111111',
      });
    }
  });
});

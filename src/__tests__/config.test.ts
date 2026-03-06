import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  it('loads read-only mode by default', () => {
    const config = loadConfig({});
    expect(config.mode).toBe('READ_ONLY');
    expect(config.maxSwapSol).toBe(1);
    expect(config.requireConfirm).toBe(true);
  });

  it('loads full mode when private key exists', () => {
    const kp = Keypair.generate();
    const encoded = bs58.encode(kp.secretKey);
    const config = loadConfig({ SOLANA_PRIVATE_KEY: encoded });

    expect(config.mode).toBe('FULL');
    expect(config.keypair?.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('throws for invalid max swap value', () => {
    expect(() => loadConfig({ MCP_MAX_SWAP_SOL: '0' })).toThrow('MCP_MAX_SWAP_SOL');
  });
});

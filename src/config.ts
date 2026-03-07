import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { McpMode } from './types.js';

export interface McpConfig {
  apiUrl: string;
  solanaRpcUrl: string;
  maxSwapSol: number;
  requireConfirm: boolean;
  txCommitment: 'processed' | 'confirmed' | 'finalized';
  mode: McpMode;
  keypair?: Keypair;
}

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null) return defaultValue;
  return value.toLowerCase() === 'true';
};

const parseCommitment = (value: string | undefined): 'processed' | 'confirmed' | 'finalized' => {
  if (!value) return 'confirmed';
  if (value === 'processed' || value === 'confirmed' || value === 'finalized') return value;
  throw new Error(`Invalid MCP_TX_COMMITMENT: ${value}`);
};

const loadKeypair = (encoded: string | undefined): Keypair | undefined => {
  if (!encoded) return undefined;
  try {
    const bytes = bs58.decode(encoded);
    return Keypair.fromSecretKey(bytes);
  } catch (error) {
    throw new Error(`Invalid SOLANA_PRIVATE_KEY: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): McpConfig => {
  const apiUrl = env.HIDOOOR_API_URL?.trim() || 'https://hidooor-production.up.railway.app';
  const solanaRpcUrl = env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';

  const maxSwapSol = Number(env.MCP_MAX_SWAP_SOL ?? '1');
  if (!Number.isFinite(maxSwapSol) || maxSwapSol <= 0) {
    throw new Error('MCP_MAX_SWAP_SOL must be a positive number');
  }

  const requireConfirm = parseBool(env.MCP_REQUIRE_CONFIRM, true);
  const txCommitment = parseCommitment(env.MCP_TX_COMMITMENT);

  const keypair = loadKeypair(env.SOLANA_PRIVATE_KEY);
  const mode: McpMode = keypair ? 'FULL' : 'READ_ONLY';

  return {
    apiUrl,
    solanaRpcUrl,
    maxSwapSol,
    requireConfirm,
    txCommitment,
    mode,
    keypair,
  };
};

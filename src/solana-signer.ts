import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

export class SolanaSigner {
  private readonly connection: Connection;

  constructor(
    private readonly rpcUrl: string,
    private readonly keypair: Keypair,
    private readonly commitment: 'processed' | 'confirmed' | 'finalized'
  ) {
    this.connection = new Connection(this.rpcUrl, this.commitment);
  }

  getWalletAddress(): string {
    return this.keypair.publicKey.toBase58();
  }

  async getBalanceLamports(): Promise<number> {
    return this.connection.getBalance(this.keypair.publicKey, this.commitment);
  }

  async transferSol(destination: string, lamports: number): Promise<string> {
    const toPubkey = new PublicKey(destination);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await this.connection.sendTransaction(transaction, [this.keypair], {
      preflightCommitment: this.commitment,
      skipPreflight: false,
      maxRetries: 2,
    });

    await this.connection.confirmTransaction(signature, this.commitment);
    return signature;
  }

  signAuthMessage(message: string): string {
    const bytes = new TextEncoder().encode(message);
    const sig = nacl.sign.detached(bytes, this.keypair.secretKey);
    return bs58.encode(sig);
  }

  static solToLamports(amountSol: number): number {
    return Math.round(amountSol * LAMPORTS_PER_SOL);
  }
}

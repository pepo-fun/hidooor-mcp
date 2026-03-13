import { McpConfig } from './config.js';
import { OrderStatusResponse, ProcessResponse, QuoteResponse, TokenInfo } from './types.js';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  timeoutMs?: number;
  retryGet?: boolean;
}

export class BackendClient {
  constructor(private readonly config: McpConfig) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? 12_000;
    const retryGet = options.retryGet ?? method === 'GET';

    const runOnce = async (): Promise<T> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.config.apiUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: options.body == null ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok) {
          const rawMessage = (payload as { error?: string; message?: string } | null)?.error || `HTTP ${response.status}`;
          const message = response.status >= 500 ? `Backend error (HTTP ${response.status})` : rawMessage;
          const error = new Error(message);
          (error as Error & { status?: number; payload?: unknown }).status = response.status;
          (error as Error & { status?: number; payload?: unknown }).payload = payload;
          throw error;
        }

        return payload as T;
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      return await runOnce();
    } catch (error) {
      if (!retryGet) throw error;
      const status = (error as Error & { status?: number }).status;
      if (status && status < 500 && status !== 429) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return runOnce();
    }
  }

  searchTokens(query: string, limit = 10): Promise<{ tokens: TokenInfo[]; count: number }> {
    return this.request(`/api/tokens/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  popularTokens(): Promise<{ tokens: TokenInfo[] }> {
    return this.request('/api/tokens/popular');
  }

  getQuote(outputMint: string, amountLamports: number): Promise<QuoteResponse> {
    return this.request(`/api/tokens/${outputMint}/quote?amountLamports=${amountLamports}`);
  }

  getMinimumAmount(): Promise<{ minimumSol: number; minimumLamports: number }> {
    return this.request('/api/privacy/fees/minimum');
  }

  getDerivedAddress(walletAddress: string): Promise<{ derivedAddress: string }> {
    return this.request(`/api/privacy/derived-address/${walletAddress}`);
  }

  getAuthMessage(walletAddress: string): Promise<{ message: string; expiresIn: string }> {
    return this.request(`/api/privacy/auth/message/${walletAddress}`);
  }

  processSwap(input: {
    signature: string;
    message: string;
    publicKey: string;
    outputMint: string;
    idempotencyKey?: string;
  }): Promise<ProcessResponse> {
    return this.request('/api/privacy/process', { method: 'POST', body: input, retryGet: false });
  }

  getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    return this.request(`/api/orders/${orderId}`);
  }

  getUserOrders(walletAddress: string): Promise<Array<{ orderId: string; status: string; outputMint: string; requestedLamports: string; createdAt: string }>> {
    return this.request(`/api/orders/user/${walletAddress}`);
  }
}

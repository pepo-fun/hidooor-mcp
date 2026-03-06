export type McpMode = 'READ_ONLY' | 'FULL';

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'BACKEND_RATE_LIMIT'
  | 'INSUFFICIENT_FUNDS'
  | 'SIGNATURE_FAILED'
  | 'PROCESS_FAILED'
  | 'TIMEOUT'
  | 'NOT_AVAILABLE_IN_READ_ONLY';

export interface ToolSuccess<T = unknown> {
  success: true;
  mode: McpMode;
  data: T;
  orderId?: string;
  txId?: string;
  nextAction?: string;
  traceId: string;
}

export interface ToolFailure {
  success: false;
  mode: McpMode;
  txId?: string;
  data?: unknown;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  nextAction?: string;
  traceId: string;
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolFailure;

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface QuoteResponse {
  formattedOutput: string;
  outputAmount: string;
  priceImpact: string;
  netSwapAmount: string;
  token?: TokenInfo;
  fees: {
    totalFeesFormatted: string;
    privacyDepositFee: number;
    privacyWithdrawFee: number;
    solanaBaseFees: number;
    ataCreationFee: number;
    serviceFee: number;
    totalFees: number;
  };
}

export interface ProcessResponse {
  orderId: string;
  status: string;
  message?: string;
  derivedAddress?: string;
  cached?: boolean;
}

export interface OrderStatusResponse {
  orderId: string;
  orderType: string;
  status: string;
  actualOutput?: string;
  outputMint?: string;
  error?: string;
  retryCount?: number;
  depositTxId?: string;
  privacyDepositTxId?: string;
  privacyWithdrawTxId?: string;
  swapTxId?: string;
  sendTxId?: string;
  refundTxId?: string;
}

const LOG_SENSITIVE = process.env.MCP_LOG_SENSITIVE === 'true';

const ALWAYS_REDACT_KEYS = new Set(['privateKey', 'secretKey']);

const SENSITIVE_KEYS = new Set([
  'wallet',
  'userWallet',
  'derivedAddress',
  'transferTxId',
  'txId',
  'privacyDepositTxId',
  'privacyWithdrawTxId',
  'swapTxId',
  'sendTxId',
  'publicKey',
  'signature',
  'privateKey',
  'secretKey',
]);

const redactValue = (value: unknown, keys: Set<string>): unknown => {
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, keys));
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      if (keys.has(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactValue(nested, keys);
      }
    }
    return output;
  }

  return value;
};

const preparePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  if (LOG_SENSITIVE) {
    return redactValue(payload, ALWAYS_REDACT_KEYS) as Record<string, unknown>;
  }
  return redactValue(payload, SENSITIVE_KEYS) as Record<string, unknown>;
};

export const logInfo = (event: string, payload: Record<string, unknown>): void => {
  // stderr keeps stdio channel clean for MCP protocol traffic.
  console.error(
    JSON.stringify({
      level: 'info',
      event,
      ts: new Date().toISOString(),
      ...preparePayload(payload),
    })
  );
};

export const logError = (event: string, payload: Record<string, unknown>): void => {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      ts: new Date().toISOString(),
      ...preparePayload(payload),
    })
  );
};

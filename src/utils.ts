import { randomUUID } from 'crypto';

export const createTraceId = (): string => randomUUID();

export const formatToolText = (payload: unknown): string => {
  return JSON.stringify(payload, null, 2);
};

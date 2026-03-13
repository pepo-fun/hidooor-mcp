export const BASE58_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isValidSolanaAddress = (address: string): boolean =>
  BASE58_ADDRESS_REGEX.test(address);

export const MIN_SWAP_SOL = 0.001;

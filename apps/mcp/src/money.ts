// Money is integer cents (bigint), as in apps/api: the LLM gets finished numbers and never does the arithmetic.
// A copy on purpose: apps/mcp can't import from the API.

export interface Money {
  amount: string;
  formatted: string;
}

/** '12.5' → 1250n. The API's amounts are positive, with 2 decimals at most. */
export function toCents(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/** 1250n → '12.50' */
export function centsToString(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

function money(symbol: string, cents: bigint): Money {
  const abs = cents < 0n ? -cents : cents;
  const whole = (abs / 100n).toLocaleString('en-US');
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return { amount: centsToString(cents), formatted: `${cents < 0n ? '-' : ''}${symbol}${whole}.${fraction}` };
}

export const eur = (cents: bigint) => money('€', cents);
export const uah = (cents: bigint) => money('₴', cents);

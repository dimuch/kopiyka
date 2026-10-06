// Money is handled as integer cents (bigint) and rates as integer 1/10000ths,
// matching the DECIMAL(…,2) amount and DECIMAL(10,4) rate columns. No floats.

export type Currency = 'EUR' | 'UAH';

/** Up to 8 whole digits and 2 decimals: 99,999,999.99 at most. */
export const AMOUNT_RE = /^\d{1,8}(\.\d{1,2})?$/;

/** '12.5' → 1250n. Callers validate with AMOUNT_RE first. */
export function toCents(amount: string): bigint {
  const [whole, frac = ''] = amount.split('.');
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'));
}

/** 1250n → '12.50' */
export function centsToString(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

/** 50.483 → 504830n (the NBU publishes at most 4 decimals). */
export function rateToE4(rate: number): bigint {
  return BigInt(Math.round(rate * 10_000));
}

export function e4ToString(e4: bigint): string {
  return `${e4 / 10_000n}.${(e4 % 10_000n).toString().padStart(4, '0')}`;
}

/** a / b for non-negative bigints, rounded half up. */
function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (b * 2n);
}

/** The entered amount in both currencies; the entered side stays exact. */
export function convert(cents: bigint, currency: Currency, rateE4: bigint): { eurCents: bigint; uahCents: bigint } {
  return currency === 'EUR'
    ? { eurCents: cents, uahCents: divRound(cents * rateE4, 10_000n) }
    : { eurCents: divRound(cents * 10_000n, rateE4), uahCents: cents };
}

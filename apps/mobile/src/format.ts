// Amounts arrive as decimal strings ('12.50'); sums are done in integer cents.

export function toCents(amount: string): number {
  const [whole, frac = ''] = amount.split('.');
  const sign = whole!.startsWith('-') ? -1 : 1;
  return sign * (Math.abs(Number(whole)) * 100 + Number(frac.padEnd(2, '0').slice(0, 2)));
}

function money(symbol: string, cents: number, decimals: 'auto' | 'never'): string {
  const showCents = decimals === 'auto' && cents % 100 !== 0;
  const value = decimals === 'never' ? Math.round(cents / 100) : cents / 100;
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return `${value < 0 ? '−' : ''}${symbol}${text}`;
}

/** €1,515 or €12.50 */
export const eur = (cents: number) => money('€', cents, 'auto');
/** ₴631 (whole hryvnias, as on the canvas) */
export const uah = (cents: number) => money('₴', cents, 'never');

/** 'YYYY-MM' of a local date. */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return monthOf(new Date(y, m - 1 + by, 1));
}

export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long' });
}

export function monthLabel(month: string): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** 'TUE 29 SEP' for '2026-09-29'. */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d);
  const weekday = day.toLocaleString('en-US', { weekday: 'short' });
  const mon = day.toLocaleString('en-US', { month: 'short' });
  return `${weekday} ${d} ${mon}`.toUpperCase();
}

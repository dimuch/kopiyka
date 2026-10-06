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

/** Typed amount → '12.50'-style string the API accepts, or null. A comma works as the decimal mark. */
export function normalizeAmount(text: string): string | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,8}(\.\d{0,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const value = `${Number(whole)}.${frac.padEnd(2, '0')}`;
  return toCents(value) > 0 ? value : null;
}

/** Live preview of the other currency, rounded half up like the server. */
export function convertPreview(cents: number, from: 'EUR' | 'UAH', rate: number): number {
  const rateE4 = Math.round(rate * 10_000);
  return from === 'EUR' ? Math.round((cents * rateE4) / 10_000) : Math.round((cents * 10_000) / rateE4);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 'YYYY-MM-DD' of a local date. */
export function dateOf(d: Date): string {
  return `${monthOf(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '6 Oct 2026' */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

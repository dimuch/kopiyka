// Amounts arrive as decimal strings ('12.50'); sums are done in integer cents.

export function toCents(amount: string): number {
  const [whole, frac = ''] = amount.split('.');
  const sign = whole!.startsWith('-') ? -1 : 1;
  return sign * (Math.abs(Number(whole)) * 100 + Number(frac.padEnd(2, '0').slice(0, 2)));
}

function money(symbol: string, cents: number, decimals: 'auto' | 'never'): string {
  const showCents = decimals === 'auto' && cents % 100 !== 0;
  // Whole amounts round halves away from zero, so negative ones mirror positive ones.
  const value = decimals === 'never' ? Math.sign(cents) * Math.round(Math.abs(cents) / 100) : cents / 100;
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return `${value < 0 ? '−' : ''}${symbol}${text}`;
}

/** €1,515 or €12.50 */
export const eur = (cents: number) => money('€', cents, 'auto');
/** ₴631 (whole hryvnias, as on the canvas; halves round away from zero) */
export const uah = (cents: number) => money('₴', cents, 'never');

/** Local noon of a 'YYYY-MM-DD' date, only to display it or seed the picker; noon stays on that day across DST. */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

/** Shifts a 'YYYY-MM-DD' date by whole days; UTC arithmetic has no DST gaps. Mirrors apps/api/src/dates.ts. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// One field per formatter: a combined pattern takes its field order from the device's locale data, which differs
// between iOS versions. Older tz databases only know the 'Europe/Kiev' spelling.
function kyivFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Kyiv' });
  } catch (err) {
    if (!(err instanceof RangeError)) throw err;
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Kiev' });
  }
}
const kyivYear = kyivFormat({ year: 'numeric' });
const kyivMonthNumber = kyivFormat({ month: '2-digit' });
const kyivDay = kyivFormat({ day: '2-digit' });

/** The 'YYYY-MM-DD' date in Kyiv at `now`, whatever the device's time zone: expenses are dated like NBU rates. */
export function kyivToday(now: Date): string {
  return `${kyivYear.format(now)}-${kyivMonthNumber.format(now)}-${kyivDay.format(now)}`;
}

/** The 'YYYY-MM' month in Kyiv at `now`. */
export function kyivMonth(now: Date): string {
  return kyivToday(now).slice(0, 7);
}

/** 'YYYY-MM' moved by `by` months ('2026-01', -1 → '2025-12'). */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
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
  const day = parseDate(date);
  const weekday = day.toLocaleString('en-US', { weekday: 'short' });
  const mon = day.toLocaleString('en-US', { month: 'short' });
  return `${weekday} ${day.getDate()} ${mon}`.toUpperCase();
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

/** The other currency's field for `text` typed in `entered`: '' while the amount is invalid or no rate is known. */
export function otherAmountText(text: string, entered: 'EUR' | 'UAH', rate: number | null): string {
  const amount = normalizeAmount(text);
  return amount && rate ? centsToInput(convertPreview(toCents(amount), entered, rate)) : '';
}

/** '6 Oct 2026'. Built from parts, like dayLabel: en-GB's short month is 'Sept' on some platforms. */
export function shortDate(date: string): string {
  const day = parseDate(date);
  return `${day.getDate()} ${day.toLocaleString('en-US', { month: 'short' })} ${day.getFullYear()}`;
}

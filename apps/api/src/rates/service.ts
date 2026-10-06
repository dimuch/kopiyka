import type { RowDataPacket } from 'mysql2/promise';
import { addDays } from '../dates.js';
import type { Db } from '../db.js';
import type { RateFetcher } from './nbu.js';

/** How far back to look when the NBU has no rate for the asked date yet. */
export const MAX_FALLBACK_DAYS = 7;

export interface EurUahRate {
  /** The date that was asked for. */
  date: string;
  /** The date the rate was set for; earlier than `date` only when falling back. */
  rateDate: string;
  /** 1 EUR in UAH, 4 decimals. */
  eurUah: number;
}

export class RateUnavailableError extends Error {
  constructor(date: string) {
    super(`No NBU EUR rate within ${MAX_FALLBACK_DAYS} days before ${date}`);
  }
}

async function cachedRate(db: Db, date: string): Promise<number | null> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT eur_uah FROM exchange_rates WHERE rate_date = ?', [date]);
  return rows[0] ? Number(rows[0].eur_uah) : null;
}

/**
 * The official EUR→UAH rate for `date`. Each NBU rate is stored once under the
 * date it was set for; a fallback to an earlier day is never stored under `date`.
 */
export async function getEurUahRate(db: Db, fetchRate: RateFetcher, date: string): Promise<EurUahRate> {
  for (let back = 0; back <= MAX_FALLBACK_DAYS; back++) {
    const day = addDays(date, -back);
    const cached = await cachedRate(db, day);
    if (cached !== null) return { date, rateDate: day, eurUah: cached };

    const fetched = await fetchRate(day);
    if (fetched !== null) {
      await db.query('INSERT IGNORE INTO exchange_rates (rate_date, eur_uah) VALUES (?, ?)', [day, fetched]);
      // Read back so the answer has the stored 4-decimal precision.
      return { date, rateDate: day, eurUah: (await cachedRate(db, day))! };
    }
  }
  throw new RateUnavailableError(date);
}

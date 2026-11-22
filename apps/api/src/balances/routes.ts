import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { kyivToday, monthOf, monthStart } from '../dates.js';
import type { Db } from '../db.js';
import { centsToString, toCents } from '../money.js';
import { MonthString } from '../monthChecks.js';
import { incomeRows, spentRows } from '../summary/periodRows.js';
import { carryBalance, type KnownMonths, type MonthBalanceCents, walkStart } from './carry.js';

/** A month's balances: signed decimal strings, '-180.00'. The month runs from opening to closing. */
export interface MonthBalanceDto {
  openingEur: string;
  closingEur: string;
}

const MonthParams = z.object({ month: MonthString });

/**
 * A 'YYYY-MM' month's Start and End for a ledger (brief 102), or null when it has none: after the current month in
 * Kyiv, before the ledger's first month (its first budgeted or imported month, whichever is earlier), or for a
 * ledger with neither. Imported months (brief 085) keep their stored numbers; the rest follow `carryBalance`.
 */
async function monthBalance(db: Db, ledgerId: number, month: string, now: Date): Promise<MonthBalanceCents | null> {
  if (month > monthOf(kyivToday(now))) return null;
  const [firstRows] = await db.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(MIN(m.list_month), '%Y-%m') AS first_month
       FROM category_months m JOIN categories c ON c.category_id = m.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL`,
    [ledgerId],
  );
  const [storedRows] = await db.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(balance_month, '%Y-%m') AS month, opening_eur, closing_eur
       FROM month_balances WHERE ledger_id = ? AND balance_month <= ?`,
    [ledgerId, monthStart(month)],
  );
  const known: KnownMonths = {
    stored: new Map(
      storedRows.map((row) => [
        row.month as string,
        { openingCents: toCents(row.opening_eur), closingCents: toCents(row.closing_eur) },
      ]),
    ),
  };
  const firstMonth = [firstRows[0]?.first_month as string | null, ...known.stored.keys()]
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort()[0];
  if (firstMonth === undefined || month < firstMonth) return null;

  const start = walkStart(month, firstMonth, known);
  const flows = new Map<string, bigint>();
  const addFlow = (rowMonth: string, cents: bigint) => flows.set(rowMonth, (flows.get(rowMonth) ?? 0n) + cents);
  if (!known.stored.has(month)) {
    for (const row of await incomeRows(db, ledgerId, monthStart(start.from), monthStart(month))) {
      addFlow(row.month, toCents(row.income_eur));
    }
    for (const row of await spentRows(db, ledgerId, monthStart(start.from), monthStart(month))) {
      addFlow(row.month, -toCents(row.spent_eur));
    }
  }
  return carryBalance(month, start, known, flows);
}

/**
 * Each month's opening and closing balance (briefs 090 and 102): imported from Notion up to October 2026, and worked
 * out in the app after that. A month without one answers `{ balance: null }`.
 */
export async function balanceRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/months/:month/balance', guards, async (req) => {
    const { month } = MonthParams.parse(req.params);
    const cents = await monthBalance(db, req.ledger!.ledgerId, month, now());
    const balance: MonthBalanceDto | null = cents
      ? { openingEur: centsToString(cents.openingCents), closingEur: centsToString(cents.closingCents) }
      : null;
    return { balance };
  });
}

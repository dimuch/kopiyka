import type { FastifyInstance, FastifyReply } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { kyivToday, monthOf, monthStart } from '../dates.js';
import type { Db } from '../db.js';
import { centsToString, SIGNED_AMOUNT_RE, toCents } from '../money.js';
import { MonthString } from '../monthChecks.js';
import { incomeRows, spentRows } from '../summary/periodRows.js';
import { carryBalance, type CarriedBalance, type KnownMonths, walkStart } from './carry.js';

/**
 * A month's balances: signed decimal strings, '-180.00'. The month runs from opening to closing; `closingEur` is the
 * End the line shows, and `actual` says it was set by hand (brief 102).
 */
export interface MonthBalanceDto {
  openingEur: string;
  closingEur: string;
  actual: boolean;
}

const MonthParams = z.object({ month: MonthString });

const ActualEndBody = z.object({
  amount: z.string().regex(SIGNED_AMOUNT_RE, 'expected an amount, 2 decimals at most'),
});

function toDto(cents: CarriedBalance): MonthBalanceDto {
  return {
    openingEur: centsToString(cents.openingCents),
    closingEur: centsToString(cents.closingCents),
    actual: cents.actual,
  };
}

/**
 * A 'YYYY-MM' month's Start and End for a ledger (brief 102), or null when it has none: after the current month in
 * Kyiv, before the ledger's first month (its first budgeted or imported month, whichever is earlier), or for a
 * ledger with neither. Imported months (brief 085) keep their stored numbers, an actual End replaces a month's End,
 * and the rest follow `carryBalance`.
 */
async function monthBalance(db: Db, ledgerId: number, month: string, now: Date): Promise<CarriedBalance | null> {
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
  const [actualRows] = await db.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(balance_month, '%Y-%m') AS month, closing_eur
       FROM month_actual_ends WHERE ledger_id = ? AND balance_month <= ?`,
    [ledgerId, monthStart(month)],
  );
  const known: KnownMonths = {
    stored: new Map(
      storedRows.map((row) => [
        row.month as string,
        { openingCents: toCents(row.opening_eur), closingCents: toCents(row.closing_eur) },
      ]),
    ),
    actual: new Map(actualRows.map((row) => [row.month as string, toCents(row.closing_eur)])),
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
 * Each month's opening and closing balance (briefs 090 and 102): imported months keep their stored numbers, and the
 * months after them are worked out. A month without one answers `{ balance: null }`. Any member can set a month's
 * actual End, ended months too, or clear it; a month without a line can't have one (409 `no_balance`).
 */
export async function balanceRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/months/:month/balance', guards, async (req) => {
    const { month } = MonthParams.parse(req.params);
    const cents = await monthBalance(db, req.ledger!.ledgerId, month, now());
    return { balance: cents ? toDto(cents) : null };
  });

  /**
   * Checks the month has a line, runs `write`, then answers the month read again. No lock: racing a category-list
   * edit leaves at most an unused row.
   */
  async function changeActualEnd(ledgerId: number, month: string, reply: FastifyReply, write: () => Promise<unknown>) {
    if (!(await monthBalance(db, ledgerId, month, now()))) return reply.code(409).send({ error: 'no_balance' });
    await write();
    return { balance: toDto((await monthBalance(db, ledgerId, month, now()))!) };
  }

  app.put('/api/ledgers/:id/months/:month/balance/actual-end', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    const { amount } = ActualEndBody.parse(req.body);
    const ledgerId = req.ledger!.ledgerId;
    return changeActualEnd(ledgerId, month, reply, () =>
      db.query(
        `INSERT INTO month_actual_ends (ledger_id, balance_month, closing_eur) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE closing_eur = ?`,
        [ledgerId, monthStart(month), amount, amount],
      ),
    );
  });

  app.delete('/api/ledgers/:id/months/:month/balance/actual-end', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    const ledgerId = req.ledger!.ledgerId;
    return changeActualEnd(ledgerId, month, reply, () =>
      db.query('DELETE FROM month_actual_ends WHERE ledger_id = ? AND balance_month = ?', [
        ledgerId,
        monthStart(month),
      ]),
    );
  });
}

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { MONTH_RE, nextMonthStart } from '../dates.js';
import { centsToString, toCents } from '../money.js';

/** A period's figures in EUR, as decimal strings; `leftEur` is income − spent and may be negative ('-12.50'). */
export interface SummaryTotalsDto {
  incomeEur: string;
  plannedEur: string;
  spentEur: string;
  leftEur: string;
}

const MAX_MONTHS = 24;

/** How many months `from…to` covers, both ends counted: 2026-01…2026-03 is 3. */
function monthSpan(from: string, to: string): number {
  const months = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  return months(to) - months(from) + 1;
}

const PeriodQuery = z
  .object({
    from: z.string().regex(MONTH_RE, 'expected YYYY-MM'),
    to: z.string().regex(MONTH_RE, 'expected YYYY-MM'),
  })
  .refine((q) => q.from <= q.to, 'from must not be after to')
  .refine((q) => monthSpan(q.from, q.to) <= MAX_MONTHS, `at most ${MAX_MONTHS} months`);

/** Sums one decimal-string column of the rows, in cents. */
function addRows(rows: RowDataPacket[], column: string): bigint {
  return rows.reduce((sum, row) => sum + toCents(row[column]), 0n);
}

/**
 * A period's totals for the open ledger, all members together (brief 089), read-only. Each figure uses the same rows
 * as its month endpoint: planned as `GET /categories` (a plan counts while its category is in the month's list),
 * spent as `GET /expenses`, income as `GET /months/:month/income`. Deleted categories and expenses never count.
 */
export async function summaryRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/summary', guards, async (req) => {
    const { from, to } = PeriodQuery.parse(req.query);
    const ledgerId = req.ledger!.ledgerId;
    const first = `${from}-01`;
    const last = `${to}-01`;

    const [planned] = await db.query<RowDataPacket[]>(
      `SELECT m.category_id, DATE_FORMAT(m.list_month, '%Y-%m') AS month, COALESCE(b.planned_eur, 0) AS planned_eur
         FROM category_months m
         JOIN categories c ON c.category_id = m.category_id
         LEFT JOIN category_budgets b ON b.category_id = m.category_id AND b.budget_month = m.list_month
        WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month BETWEEN ? AND ?`,
      [ledgerId, first, last],
    );
    const [spent] = await db.query<RowDataPacket[]>(
      `SELECT e.category_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS month, SUM(e.amount_eur) AS spent_eur
         FROM expenses e
         JOIN categories c ON c.category_id = e.category_id
        WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND e.deleted_at IS NULL
          AND e.expense_date >= ? AND e.expense_date < ?
        GROUP BY e.category_id, month`,
      [ledgerId, first, nextMonthStart(to)],
    );
    const [income] = await db.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(income_month, '%Y-%m') AS month, SUM(amount_eur) AS income_eur
         FROM income_items
        WHERE ledger_id = ? AND income_month BETWEEN ? AND ?
        GROUP BY month`,
      [ledgerId, first, last],
    );

    const incomeCents = addRows(income, 'income_eur');
    const spentCents = addRows(spent, 'spent_eur');
    const totals: SummaryTotalsDto = {
      incomeEur: centsToString(incomeCents),
      plannedEur: centsToString(addRows(planned, 'planned_eur')),
      spentEur: centsToString(spentCents),
      leftEur: centsToString(incomeCents - spentCents),
    };
    return { totals };
  });
}

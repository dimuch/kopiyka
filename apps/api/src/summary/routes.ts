import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { NAME_IN_MONTH } from '../categories/monthLists.js';
import { MONTH_RE, nextMonthStart } from '../dates.js';
import { centsToString, toCents } from '../money.js';

/** A period's figures in EUR, as decimal strings; `leftEur` is income − spent and may be negative ('-12.50'). */
export interface SummaryTotalsDto {
  incomeEur: string;
  plannedEur: string;
  spentEur: string;
  leftEur: string;
}

/** One month of the period; a month with nothing in it is all '0.00'. */
export interface SummaryMonthDto {
  /** 'YYYY-MM'. */
  month: string;
  incomeEur: string;
  spentEur: string;
  leftEur: string;
}

/** A category's figures over the period. */
export interface SummaryCategoryDto {
  categoryId: number;
  /** Its name in the period's last month. */
  name: string;
  plannedEur: string;
  spentEur: string;
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

/** Sums one decimal-string column of the rows, in cents; with `month`, only that month's rows. */
function addRows(rows: RowDataPacket[], column: string, month?: string): bigint {
  return rows.reduce((sum, row) => (month === undefined || row.month === month ? sum + toCents(row[column]) : sum), 0n);
}

/** -1, 0 or 1, for sorting by an amount. */
const compareCents = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** Every month `from…to`, oldest first. */
function periodMonths(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = nextMonthStart(month).slice(0, 7)) months.push(month);
  return months;
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
    const months: SummaryMonthDto[] = periodMonths(from, to).map((month) => {
      const monthIncome = addRows(income, 'income_eur', month);
      const monthSpent = addRows(spent, 'spent_eur', month);
      return {
        month,
        incomeEur: centsToString(monthIncome),
        spentEur: centsToString(monthSpent),
        leftEur: centsToString(monthIncome - monthSpent),
      };
    });
    const [named] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, ${NAME_IN_MONTH} AS name, c.sort_order FROM categories c
        WHERE c.ledger_id = ? AND c.deleted_at IS NULL`,
      [last, ledgerId],
    );
    // Listed in a month of the period, or spent on there; the planned and spent rows already leave deleted data out.
    const inPeriod = new Set([...planned, ...spent].map((row) => row.category_id as number));
    const ofCategory = (rows: RowDataPacket[], categoryId: number) =>
      rows.filter((row) => row.category_id === categoryId);
    const categories: SummaryCategoryDto[] = named
      .filter((row) => inPeriod.has(row.category_id))
      .map((row) => ({
        categoryId: row.category_id as number,
        name: row.name as string,
        sortOrder: row.sort_order as number,
        plannedCents: addRows(ofCategory(planned, row.category_id), 'planned_eur'),
        spentCents: addRows(ofCategory(spent, row.category_id), 'spent_eur'),
      }))
      .sort(
        (a, b) => compareCents(b.spentCents, a.spentCents) || a.sortOrder - b.sortOrder || a.categoryId - b.categoryId,
      )
      .map(({ categoryId, name, plannedCents, spentCents }) => ({
        categoryId,
        name,
        plannedEur: centsToString(plannedCents),
        spentEur: centsToString(spentCents),
      }));
    return { totals, months, categories };
  });
}

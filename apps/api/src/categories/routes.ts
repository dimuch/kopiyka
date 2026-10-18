import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { MONTH_RE, monthEnded, nextMonthStart } from '../dates.js';
import { AMOUNT_RE } from '../money.js';
import {
  copyPreviousMonth,
  inMonthList,
  NAME_IN_MONTH,
  removeFromMonth,
  renameInMonth,
  restoreToMonth,
  setPlanned,
} from './monthLists.js';

export const QUICK_CATEGORY_COUNT = 5;

export interface CategoryDto {
  categoryId: number;
  techName: string;
  /** The month's name (brief 037). */
  displayName: string;
  sortOrder: number;
  /** The month's planned EUR (brief 036): a decimal string ≥ 0, '0.00' when none is set. */
  plannedEur: string;
}

/** One category with its live expenses in one month (`?month=`), and whether that month's list has it. */
export interface CategoryWithTotalsDto extends CategoryDto {
  expenseCount: number;
  /** Decimal string, '0.00' without expenses. */
  totalEur: string;
  /**
   * False when the month's list lacks it (removed there, or the month has no list); it then has no live expenses
   * there.
   */
  inMonth: boolean;
}

const CategoryParams = z.object({ categoryId: z.coerce.number().int().positive() });
/**
 * A required 'YYYY-MM' month: the list's and one category's query (every caller sends it since briefs 030 and 032),
 * and copy's path.
 */
const Month = z.object({ month: z.string().regex(MONTH_RE, 'expected YYYY-MM') });
const MonthParams = CategoryParams.extend(Month.shape);
// 1–40 characters after trimming (brief 037).
const NameBody = z.object({ name: z.string().trim().min(1).max(40) });
// Money crosses the wire as decimal strings; €0 is a plan.
const PlannedBody = z.object({ amount: z.string().regex(AMOUNT_RE, 'expected an amount ≥ 0, 2 decimals at most') });

function toDto(r: RowDataPacket): CategoryDto {
  return {
    categoryId: r.category_id,
    techName: r.tech_name,
    displayName: r.display_name,
    sortOrder: r.sort_order,
    plannedEur: r.planned_eur,
  };
}

/**
 * The Add expense quick row: categories by their latest expense, newest first;
 * never-used ones follow in sort order.
 */
export function pickQuick(rows: Array<{ categoryId: number; sortOrder: number; lastUsedAt: Date | null }>): number[] {
  return [...rows]
    .sort((a, b) => {
      if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
      if (a.lastUsedAt) return -1;
      if (b.lastUsedAt) return 1;
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, QUICK_CATEGORY_COUNT)
    .map((r) => r.categoryId);
}

export async function categoryRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/categories', guards, async (req) => {
    const { month } = Month.parse(req.query);
    const first = `${month}-01`;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, ${NAME_IN_MONTH} AS display_name, c.sort_order,
              COALESCE(b.planned_eur, 0) AS planned_eur,
              u.last_used_at
           FROM categories c
           LEFT JOIN category_budgets b ON b.category_id = c.category_id AND b.budget_month = ?
           LEFT JOIN (
             SELECT category_id, MAX(created_at) AS last_used_at
               FROM expenses
              WHERE deleted_at IS NULL
              GROUP BY category_id
           ) u ON u.category_id = c.category_id
          WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}
          ORDER BY c.sort_order, c.category_id`,
      [first /* name */, first /* b */, req.ledger!.ledgerId, first /* inMonthList */],
    );

    const categories = rows.map(toDto);
    const quickCategoryIds = pickQuick(
      rows.map((r) => ({ categoryId: r.category_id, sortOrder: r.sort_order, lastUsedAt: r.last_used_at })),
    );
    return { categories, quickCategoryIds };
  });

  app.get('/api/ledgers/:id/categories/:categoryId', guards, async (req, reply) => {
    const { categoryId } = CategoryParams.parse(req.params);
    const { month } = Month.parse(req.query);
    const first = `${month}-01`;
    // A category the month lacks is still named (the app says it isn't in that month). Its counts are 0: no live
    // expense can sit in a month whose list lacks its category.
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, ${NAME_IN_MONTH} AS display_name, c.sort_order,
              ${inMonthList('?')} AS in_month,
              COALESCE(b.planned_eur, 0) AS planned_eur,
              COUNT(e.expense_id) AS expense_count, COALESCE(SUM(e.amount_eur), 0) AS total_eur
         FROM categories c
         LEFT JOIN category_budgets b ON b.category_id = c.category_id AND b.budget_month = ?
         LEFT JOIN expenses e ON e.category_id = c.category_id AND e.deleted_at IS NULL
                             AND e.expense_date >= ? AND e.expense_date < ?
        WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL
        GROUP BY c.category_id`,
      [
        first /* name */,
        first /* in_month */,
        first /* b */,
        first,
        nextMonthStart(month),
        categoryId,
        req.ledger!.ledgerId,
      ],
    );
    const r = rows[0];
    if (!r) return reply.code(404).send({ error: 'not_found' });
    const dto: CategoryWithTotalsDto = {
      ...toDto(r),
      expenseCount: r.expense_count,
      totalEur: r.total_eur,
      inMonth: Boolean(r.in_month),
    };
    return dto;
  });

  // Brief 029. An ended month is read-only (brief 028's decisions), so it's refused before anything is read.
  app.delete('/api/ledgers/:id/categories/:categoryId/months/:month', guards, async (req, reply) => {
    const { categoryId, month } = MonthParams.parse(req.params);
    const at = now();
    if (monthEnded(month, at)) return reply.code(409).send({ error: 'month_ended' });
    return (await removeFromMonth(db, req.ledger!.ledgerId, categoryId, month, at))
      ? reply.code(204).send()
      : reply.code(404).send({ error: 'not_found' });
  });

  app.post('/api/ledgers/:id/categories/:categoryId/months/:month/restore', guards, async (req, reply) => {
    const { categoryId, month } = MonthParams.parse(req.params);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    const result = await restoreToMonth(db, req.ledger!.ledgerId, categoryId, month);
    if (result === 'not_found') return reply.code(404).send({ error: 'not_found' });
    // The request is fine; the month's current names clash with it (brief 037).
    if (result === 'name_taken') return reply.code(409).send({ error: 'name_taken' });
    return reply.code(204).send();
  });

  // Brief 036. An ended month is read-only, so it's refused before anything is read.
  app.put('/api/ledgers/:id/categories/:categoryId/months/:month/planned', guards, async (req, reply) => {
    const { categoryId, month } = MonthParams.parse(req.params);
    const { amount } = PlannedBody.parse(req.body);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    return (await setPlanned(db, req.ledger!.ledgerId, categoryId, month, amount))
      ? reply.code(204).send()
      : reply.code(404).send({ error: 'not_found' });
  });

  // Brief 037. An ended month is read-only, so it's refused before anything is read.
  app.put('/api/ledgers/:id/categories/:categoryId/months/:month/name', guards, async (req, reply) => {
    const { categoryId, month } = MonthParams.parse(req.params);
    const { name } = NameBody.parse(req.body);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    const result = await renameInMonth(db, req.ledger!.ledgerId, categoryId, month, name);
    if (result === 'not_found') return reply.code(404).send({ error: 'not_found' });
    if (result === 'name_taken') return reply.code(400).send({ error: 'name_taken' });
    return reply.code(204).send();
  });

  // Brief 033: sets up a month with no budget from the month before it.
  app.post('/api/ledgers/:id/months/:month/copy', guards, async (req, reply) => {
    const { month } = Month.parse(req.params);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    const result = await copyPreviousMonth(db, req.ledger!.ledgerId, month);
    return result === 'copied' ? reply.code(204).send() : reply.code(409).send({ error: result });
  });
}

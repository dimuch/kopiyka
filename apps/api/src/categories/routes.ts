import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { monthStart, nextMonthStart } from '../dates.js';
import { overIncomeError } from '../income/limit.js';
import { AMOUNT_RE, centsToString, toCents } from '../money.js';
import { checkMonthOpen, MonthParams } from '../monthChecks.js';
import {
  addToMonth,
  copyPreviousMonth,
  editInMonth,
  inMonthList,
  NAME_IN_MONTH,
  removeFromMonth,
  restoreToMonth,
} from './monthLists.js';
import { CATEGORY_ICONS } from './icons.js';
import { IN_MY_ORDER, MY_ORDER_JOIN, saveOrder } from './order.js';

export const QUICK_CATEGORY_COUNT = 5;

export interface CategoryDto {
  categoryId: number;
  techName: string;
  /** The month's name (brief 037). */
  displayName: string;
  /** The ledger's order. A list comes in the caller's own order instead (brief 092). */
  sortOrder: number;
  /** The month's planned EUR (brief 036): a decimal string ≥ 0, '0.00' when none is set. */
  plannedEur: string;
  /** A key from `categories/icons.ts`; null shows the letter (brief 114). The same in every month. */
  icon: string | null;
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
// `MonthParams` is a required month: the list's and one category's query (every caller sends it since briefs 030 and
// 032), and copy's and add's path.
const CategoryMonthParams = CategoryParams.extend(MonthParams.shape);
// 1–40 characters after trimming (brief 037).
const NameBody = z.object({ name: z.string().trim().min(1).max(40) });
// Money crosses the wire as decimal strings; €0 is a plan.
const Amount = z.string().regex(AMOUNT_RE, 'expected an amount ≥ 0, 2 decimals at most');
// Brief 114: a key from the list, or null to clear it and show the letter.
const IconKey = z.enum(CATEGORY_ICONS).nullable();
const AddBody = NameBody.extend({ amount: Amount.default('0'), icon: IconKey.optional() });
// A field left out stays as it is, so saving one can't overwrite the other a member just changed (brief 065).
const EditBody = z
  .object({ name: NameBody.shape.name.optional(), amount: Amount.optional(), icon: IconKey.optional() })
  .refine(
    ({ name, amount, icon }) => name !== undefined || amount !== undefined || icon !== undefined,
    'expected a name, an amount or an icon',
  );
// Brief 092: one month's list in its new order, top first. The cap is far above any ledger's list.
const OrderBody = z.object({
  categoryIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'expected each id once'),
});

function toDto(row: RowDataPacket): CategoryDto {
  return {
    categoryId: row.category_id,
    techName: row.tech_name,
    displayName: row.display_name,
    sortOrder: row.sort_order,
    plannedEur: row.planned_eur,
    icon: row.icon,
  };
}

/**
 * The Add expense quick row (brief 099): the first five of a month's list, which comes in the caller's own order
 * (brief 092), so dragging a category to the top puts it in the row. It replaces 092's most-recently-used rule, so
 * each member gets their own row and it no longer shifts when anyone adds an expense.
 */
export function pickQuick(categories: CategoryDto[]): number[] {
  return categories.slice(0, QUICK_CATEGORY_COUNT).map((category) => category.categoryId);
}

export async function categoryRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/categories', guards, async (req) => {
    const { month } = MonthParams.parse(req.query);
    const first = monthStart(month);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, ${NAME_IN_MONTH} AS display_name, c.sort_order, c.icon,
              COALESCE(b.planned_eur, 0) AS planned_eur
           FROM categories c
           LEFT JOIN category_budgets b ON b.category_id = c.category_id AND b.budget_month = ?
           ${MY_ORDER_JOIN}
          WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}
          ORDER BY ${IN_MY_ORDER}`,
      [first /* name */, first /* b */, req.auth!.userId /* o */, req.ledger!.ledgerId, first /* inMonthList */],
    );

    const categories = rows.map(toDto);
    return { categories, quickCategoryIds: pickQuick(categories) };
  });

  app.get('/api/ledgers/:id/categories/:categoryId', guards, async (req, reply) => {
    const { categoryId } = CategoryParams.parse(req.params);
    const { month } = MonthParams.parse(req.query);
    const first = monthStart(month);
    // A category the month lacks is still named (the app says it isn't in that month). Its counts are 0: no live
    // expense can sit in a month whose list lacks its category.
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, ${NAME_IN_MONTH} AS display_name, c.sort_order, c.icon,
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
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: 'not_found' });
    const dto: CategoryWithTotalsDto = {
      ...toDto(row),
      expenseCount: row.expense_count,
      totalEur: row.total_eur,
      inMonth: Boolean(row.in_month),
    };
    return dto;
  });

  // Brief 092. The order isn't month data, so there's no month_ended check.
  app.put('/api/ledgers/:id/categories/order', guards, async (req, reply) => {
    const { categoryIds } = OrderBody.parse(req.body);
    const result = await saveOrder(db, req.ledger!.ledgerId, req.auth!.userId, categoryIds);
    if (result === 'unknown_category') return reply.code(400).send({ error: 'unknown_category' });
    return reply.code(204).send();
  });

  // Brief 029. An ended month is read-only (brief 028's decisions), so it's refused before anything is read.
  app.delete('/api/ledgers/:id/categories/:categoryId/months/:month', guards, async (req, reply) => {
    const { categoryId, month } = CategoryMonthParams.parse(req.params);
    const at = now();
    if (!checkMonthOpen(reply, at, month)) return reply;
    return (await removeFromMonth(db, req.ledger!.ledgerId, categoryId, month, at))
      ? reply.code(204).send()
      : reply.code(404).send({ error: 'not_found' });
  });

  app.post('/api/ledgers/:id/categories/:categoryId/months/:month/restore', guards, async (req, reply) => {
    const { categoryId, month } = CategoryMonthParams.parse(req.params);
    if (!checkMonthOpen(reply, now(), month)) return reply;
    const result = await restoreToMonth(db, req.ledger!.ledgerId, categoryId, month);
    if (result === 'not_found') return reply.code(404).send({ error: 'not_found' });
    // The request is fine; the month's current names clash with it (brief 037).
    if (result === 'name_taken') return reply.code(409).send({ error: 'name_taken' });
    if (result !== 'restored') return reply.code(409).send(overIncomeError(result));
    return reply.code(204).send();
  });

  // Brief 065. An ended month is read-only, so it's refused before anything is read.
  app.patch('/api/ledgers/:id/categories/:categoryId/months/:month', guards, async (req, reply) => {
    const { categoryId, month } = CategoryMonthParams.parse(req.params);
    const changes = EditBody.parse(req.body);
    if (!checkMonthOpen(reply, now(), month)) return reply;
    const result = await editInMonth(db, req.ledger!.ledgerId, categoryId, month, changes);
    if (result === 'not_found') return reply.code(404).send({ error: 'not_found' });
    if (result === 'name_taken') return reply.code(400).send({ error: 'name_taken' });
    if (result !== 'edited') return reply.code(409).send(overIncomeError(result));
    return reply.code(204).send();
  });

  // Brief 033: sets up a month with no budget from the month before it.
  app.post('/api/ledgers/:id/months/:month/copy', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    if (!checkMonthOpen(reply, now(), month)) return reply;
    const result = await copyPreviousMonth(db, req.ledger!.ledgerId, month);
    return result === 'copied' ? reply.code(204).send() : reply.code(409).send({ error: result });
  });

  // Brief 038. An ended month is read-only, so it's refused before anything is read.
  app.post('/api/ledgers/:id/months/:month/categories', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    const { name, amount, icon } = AddBody.parse(req.body);
    if (!checkMonthOpen(reply, now(), month)) return reply;
    const added = await addToMonth(db, req.ledger!.ledgerId, month, name, amount, icon);
    if (added === 'name_taken') return reply.code(400).send({ error: 'name_taken' });
    if ('overCents' in added) return reply.code(409).send(overIncomeError(added));
    const dto: CategoryDto = { ...added, displayName: name, plannedEur: centsToString(toCents(amount)) };
    return reply.code(201).send(dto);
  });
}

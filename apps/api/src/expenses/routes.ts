import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { addDays } from '../dates.js';
import { AMOUNT_RE, centsToString, convert, e4ToString, rateToE4, toCents } from '../money.js';
import { getEurUahRate, isAfterRateHorizon, RateDate, rateUnavailableReason } from '../rates/service.js';

export interface ExpenseDto {
  expenseId: number;
  categoryId: number;
  expenseDate: string;
  name: string;
  /** Decimal strings, exactly as stored: '12.50', '631.04', '50.4830'. */
  amountEur: string;
  amountUah: string;
  eurUahRate: string;
  enteredCurrency: 'EUR' | 'UAH';
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

const EXPENSE_COLUMNS = `e.expense_id, e.category_id, e.expense_date, e.name, e.amount_eur, e.amount_uah,
  e.eur_uah_rate, e.entered_currency, e.created_by, e.created_at, e.updated_at`;

function toDto(r: RowDataPacket): ExpenseDto {
  return {
    expenseId: Number(r.expense_id),
    categoryId: r.category_id,
    expenseDate: r.expense_date,
    name: r.name,
    amountEur: r.amount_eur,
    amountUah: r.amount_uah,
    eurUahRate: r.eur_uah_rate,
    enteredCurrency: r.entered_currency,
    createdBy: r.created_by,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

const ExpenseBody = z.object({
  categoryId: z.number().int().positive(),
  expenseDate: RateDate,
  name: z.string().trim().max(200).default(''),
  // A string keeps the cents exact; numbers like 12.5 are accepted too.
  amount: z
    .union([z.string(), z.number()])
    .transform(String)
    .refine((a) => AMOUNT_RE.test(a) && toCents(a) > 0n, 'expected a positive amount with at most 2 decimals'),
  currency: z.enum(['EUR', 'UAH']),
});
type ExpenseInput = z.infer<typeof ExpenseBody>;

const ExpenseParams = z.object({ expenseId: z.coerce.number().int().positive() });

const MonthQuery = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM'),
  categoryId: z.coerce.number().int().positive().optional(),
});

export async function expenseRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { db, fetchRate, now } = deps;
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  /** Replies 400 and returns false unless the category is an active one in this ledger. */
  async function checkCategory(req: FastifyRequest, reply: FastifyReply, categoryId: number): Promise<boolean> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT 1 FROM categories WHERE category_id = ? AND ledger_id = ? AND is_active = 1',
      [categoryId, req.ledger!.ledgerId],
    );
    if (rows.length) return true;
    reply.code(400).send({ error: 'unknown_category' });
    return false;
  }

  /** The stored amounts for an input, at the NBU rate of its date. Replies 400/503 and returns null when it can't. */
  async function price(req: FastifyRequest, reply: FastifyReply, input: ExpenseInput) {
    if (isAfterRateHorizon(input.expenseDate, now())) {
      reply.code(400).send({ error: 'date_in_future' });
      return null;
    }
    let rateE4: bigint;
    try {
      rateE4 = rateToE4((await getEurUahRate(db, fetchRate, input.expenseDate)).eurUah);
    } catch (err) {
      if (!rateUnavailableReason(err)) throw err;
      req.log.warn({ err, date: input.expenseDate }, 'EUR rate unavailable for expense');
      reply.code(503).send({ error: 'rate_unavailable' });
      return null;
    }
    const { eurCents, uahCents } = convert(toCents(input.amount), input.currency, rateE4);
    return { amountEur: centsToString(eurCents), amountUah: centsToString(uahCents), rate: e4ToString(rateE4) };
  }

  async function loadExpense(ledgerId: number, expenseId: number): Promise<ExpenseDto | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ${EXPENSE_COLUMNS} FROM expenses e JOIN categories c ON c.category_id = e.category_id
        WHERE e.expense_id = ? AND c.ledger_id = ? AND e.deleted_at IS NULL`,
      [expenseId, ledgerId],
    );
    return rows[0] ? toDto(rows[0]) : null;
  }

  app.get('/api/ledgers/:id/expenses', guards, async (req) => {
    const { month, categoryId } = MonthQuery.parse(req.query);
    const first = `${month}-01`;
    const next = addDays(`${month}-28`, 4).slice(0, 7) + '-01';
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ${EXPENSE_COLUMNS} FROM expenses e JOIN categories c ON c.category_id = e.category_id
        WHERE c.ledger_id = ? AND e.deleted_at IS NULL
          AND e.expense_date >= ? AND e.expense_date < ?
          ${categoryId ? 'AND e.category_id = ?' : ''}
        ORDER BY e.expense_date DESC, e.created_at DESC, e.expense_id DESC`,
      [req.ledger!.ledgerId, first, next, ...(categoryId ? [categoryId] : [])],
    );
    return { expenses: rows.map(toDto) };
  });

  app.get('/api/ledgers/:id/expenses/:expenseId', guards, async (req, reply) => {
    const { expenseId } = ExpenseParams.parse(req.params);
    const expense = await loadExpense(req.ledger!.ledgerId, expenseId);
    if (!expense) return reply.code(404).send({ error: 'not_found' });
    return expense;
  });

  app.post('/api/ledgers/:id/expenses', guards, async (req, reply) => {
    const input = ExpenseBody.parse(req.body);
    if (!(await checkCategory(req, reply, input.categoryId))) return reply;
    const priced = await price(req, reply, input);
    if (!priced) return reply;

    const at = now();
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, amount_uah, eur_uah_rate,
                             entered_currency, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.categoryId,
        input.expenseDate,
        input.name,
        priced.amountEur,
        priced.amountUah,
        priced.rate,
        input.currency,
        req.auth!.userId,
        at,
        at,
      ],
    );
    return reply.code(201).send(await loadExpense(req.ledger!.ledgerId, res.insertId));
  });

  app.put('/api/ledgers/:id/expenses/:expenseId', guards, async (req, reply) => {
    const { expenseId } = ExpenseParams.parse(req.params);
    const input = ExpenseBody.parse(req.body);
    const current = await loadExpense(req.ledger!.ledgerId, expenseId);
    if (!current) return reply.code(404).send({ error: 'not_found' });
    // Moving to another category needs an active one; staying in a since-hidden one is fine.
    if (input.categoryId !== current.categoryId && !(await checkCategory(req, reply, input.categoryId))) return reply;
    const priced = await price(req, reply, input);
    if (!priced) return reply;

    await db.query(
      `UPDATE expenses SET category_id = ?, expense_date = ?, name = ?, amount_eur = ?, amount_uah = ?,
                           eur_uah_rate = ?, entered_currency = ?, updated_at = ?
        WHERE expense_id = ?`,
      [
        input.categoryId,
        input.expenseDate,
        input.name,
        priced.amountEur,
        priced.amountUah,
        priced.rate,
        input.currency,
        now(),
        expenseId,
      ],
    );
    return loadExpense(req.ledger!.ledgerId, expenseId);
  });

  /** Sets or clears deleted_at on an expense of this ledger; false when no expense was in the other state. */
  async function setDeleted(ledgerId: number, expenseId: number, deleted: boolean): Promise<boolean> {
    const [res] = await db.query<ResultSetHeader>(
      `UPDATE expenses e JOIN categories c ON c.category_id = e.category_id
          SET e.deleted_at = ?, e.updated_at = e.updated_at -- not an edit; keep ON UPDATE from firing
        WHERE e.expense_id = ? AND c.ledger_id = ? AND e.deleted_at IS ${deleted ? '' : 'NOT '}NULL`,
      [deleted ? now() : null, expenseId, ledgerId],
    );
    return res.affectedRows === 1;
  }

  // Soft delete: the row stays so the app's Undo can restore it.
  app.delete('/api/ledgers/:id/expenses/:expenseId', guards, async (req, reply) => {
    const { expenseId } = ExpenseParams.parse(req.params);
    if (!(await setDeleted(req.ledger!.ledgerId, expenseId, true))) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });

  app.post('/api/ledgers/:id/expenses/:expenseId/restore', guards, async (req, reply) => {
    const { expenseId } = ExpenseParams.parse(req.params);
    if (!(await setDeleted(req.ledger!.ledgerId, expenseId, false)))
      return reply.code(404).send({ error: 'not_found' });
    return loadExpense(req.ledger!.ledgerId, expenseId);
  });
}

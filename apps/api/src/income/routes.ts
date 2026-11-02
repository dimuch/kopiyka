import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { lockLedger } from '../categories/monthLists.js';
import { MONTH_RE, monthEnded, previousMonthStart } from '../dates.js';
import { withTransaction } from '../db.js';
import { AMOUNT_RE, centsToString, toCents } from '../money.js';

export interface IncomeItemDto {
  incomeId: number;
  title: string;
  /** Decimal string > 0, as stored: '2500.00'. */
  amountEur: string;
  /** Username of the member who added it; an edit by someone else doesn't change it. */
  addedBy: string;
}

const MonthParams = z.object({ month: z.string().regex(MONTH_RE, 'expected YYYY-MM') });
const IncomeParams = z.object({ incomeId: z.coerce.number().int().positive() });
// 1–40 characters after trimming, like category names. Money crosses the wire as decimal strings.
const IncomeBody = z.object({
  title: z.string().trim().min(1).max(40),
  amount: z
    .string()
    .refine((amount) => AMOUNT_RE.test(amount) && toCents(amount) > 0n, 'expected an amount > 0, 2 decimals at most'),
});

function toDto(row: RowDataPacket): IncomeItemDto {
  return { incomeId: row.income_id, title: row.title, amountEur: row.amount_eur, addedBy: row.added_by };
}

type Refusal = 'not_found' | 'month_ended';

function sendRefusal(reply: FastifyReply, refusal: Refusal): FastifyReply {
  return reply.code(refusal === 'not_found' ? 404 : 409).send({ error: refusal });
}

/** A ledger's income items per month (brief 058). Any member reads and writes any item. */
export async function incomeRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  /**
   * Locks the ledger, then says why an existing item can't change: unknown or another ledger's, or in an ended
   * month. Null when it can.
   */
  async function refuseChange(conn: PoolConnection, ledgerId: number, incomeId: number): Promise<Refusal | null> {
    await lockLedger(conn, ledgerId);
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT income_month FROM income_items WHERE income_id = ? AND ledger_id = ?',
      [incomeId, ledgerId],
    );
    const item = rows[0];
    if (!item) return 'not_found';
    return monthEnded(item.income_month.slice(0, 7), now()) ? 'month_ended' : null;
  }

  app.get('/api/ledgers/:id/months/:month/income', guards, async (req) => {
    const { month } = MonthParams.parse(req.params);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT i.income_id, i.title, i.amount_eur, u.username AS added_by
         FROM income_items i
         JOIN users u ON u.user_id = i.created_by
        WHERE i.ledger_id = ? AND i.income_month = ?
        ORDER BY i.income_id`,
      [req.ledger!.ledgerId, `${month}-01`],
    );
    return { items: rows.map(toDto) };
  });

  // An ended month is read-only, so it's refused before anything is written.
  app.post('/api/ledgers/:id/months/:month/income', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    const { title, amount } = IncomeBody.parse(req.body);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    const ledgerId = req.ledger!.ledgerId;
    const amountEur = centsToString(toCents(amount));
    const incomeId = await withTransaction(db, async (conn) => {
      await lockLedger(conn, ledgerId);
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
        [ledgerId, `${month}-01`, title, amountEur, req.auth!.userId],
      );
      return res.insertId;
    });
    const dto: IncomeItemDto = { incomeId, title, amountEur, addedBy: req.auth!.username };
    return reply.code(201).send(dto);
  });

  // Any member edits any item; who added it stays. An item in an ended month is read-only.
  app.put('/api/ledgers/:id/income/:incomeId', guards, async (req, reply) => {
    const { incomeId } = IncomeParams.parse(req.params);
    const { title, amount } = IncomeBody.parse(req.body);
    const ledgerId = req.ledger!.ledgerId;
    const refused = await withTransaction(db, async (conn) => {
      const refusal = await refuseChange(conn, ledgerId, incomeId);
      if (refusal) return refusal;
      await conn.query('UPDATE income_items SET title = ?, amount_eur = ? WHERE income_id = ?', [
        title,
        centsToString(toCents(amount)),
        incomeId,
      ]);
      return null;
    });
    return refused ? sendRefusal(reply, refused) : reply.code(204).send();
  });

  // Any member deletes any item, at once: there is no Undo. An item in an ended month is read-only.
  app.delete('/api/ledgers/:id/income/:incomeId', guards, async (req, reply) => {
    const { incomeId } = IncomeParams.parse(req.params);
    const ledgerId = req.ledger!.ledgerId;
    const refused = await withTransaction(db, async (conn) => {
      const refusal = await refuseChange(conn, ledgerId, incomeId);
      if (refusal) return refusal;
      await conn.query('DELETE FROM income_items WHERE income_id = ?', [incomeId]);
      return null;
    });
    return refused ? sendRefusal(reply, refused) : reply.code(204).send();
  });

  // Fills a month with no income from the month before it: titles and amounts, since income usually repeats.
  app.post('/api/ledgers/:id/months/:month/income/copy', guards, async (req, reply) => {
    const { month } = MonthParams.parse(req.params);
    if (monthEnded(month, now())) return reply.code(409).send({ error: 'month_ended' });
    const ledgerId = req.ledger!.ledgerId;
    const first = `${month}-01`;
    const result = await withTransaction(db, async (conn) => {
      await lockLedger(conn, ledgerId);
      const [existing] = await conn.query<RowDataPacket[]>(
        'SELECT 1 FROM income_items WHERE ledger_id = ? AND income_month = ? LIMIT 1',
        [ledgerId, first],
      );
      if (existing.length) return 'income_exists';
      const [copied] = await conn.query<ResultSetHeader>(
        `INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by)
         SELECT ledger_id, ?, title, amount_eur, ?
           FROM income_items
          WHERE ledger_id = ? AND income_month = ?
          ORDER BY income_id`,
        [first, req.auth!.userId, ledgerId, previousMonthStart(month)],
      );
      return copied.affectedRows ? 'copied' : 'no_previous_income';
    });
    return result === 'copied' ? reply.code(204).send() : reply.code(409).send({ error: result });
  });
}

import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { lockLedger } from '../categories/monthLists.js';
import { MONTH_RE, monthEnded } from '../dates.js';
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
// 1–40 characters after trimming, like category names. Money crosses the wire as decimal strings.
const IncomeBody = z.object({
  title: z.string().trim().min(1).max(40),
  amount: z
    .string()
    .refine((amount) => AMOUNT_RE.test(amount) && toCents(amount) > 0n, 'expected an amount > 0, 2 decimals at most'),
});

function toDto(r: RowDataPacket): IncomeItemDto {
  return { incomeId: r.income_id, title: r.title, amountEur: r.amount_eur, addedBy: r.added_by };
}

/** A ledger's income items per month (brief 058). Any member reads and writes any item. */
export async function incomeRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

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
}

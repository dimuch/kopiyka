import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { MONTH_RE } from '../dates.js';

export interface IncomeItemDto {
  incomeId: number;
  title: string;
  /** Decimal string > 0, as stored: '2500.00'. */
  amountEur: string;
  /** Username of the member who added it; an edit by someone else doesn't change it. */
  addedBy: string;
}

const MonthParams = z.object({ month: z.string().regex(MONTH_RE, 'expected YYYY-MM') });

function toDto(r: RowDataPacket): IncomeItemDto {
  return { incomeId: r.income_id, title: r.title, amountEur: r.amount_eur, addedBy: r.added_by };
}

/** A ledger's income items per month (brief 058). Any member reads and writes any item. */
export async function incomeRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
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
}

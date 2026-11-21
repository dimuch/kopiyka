import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { monthStart } from '../dates.js';
import { MonthString } from '../monthChecks.js';

/** A month's balances as stored: signed decimal strings, '-180.00'. The month runs from opening to closing. */
export interface MonthBalanceDto {
  openingEur: string;
  closingEur: string;
}

const MonthParams = z.object({ month: MonthString });

/**
 * Each month's opening and closing balance (brief 090), read-only. The rows come from brief 085's Notion import;
 * a month without one answers `{ balance: null }`.
 */
export async function balanceRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/months/:month/balance', guards, async (req) => {
    const { month } = MonthParams.parse(req.params);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT opening_eur, closing_eur FROM month_balances WHERE ledger_id = ? AND balance_month = ?',
      [req.ledger!.ledgerId, monthStart(month)],
    );
    const row = rows[0];
    const balance: MonthBalanceDto | null = row ? { openingEur: row.opening_eur, closingEur: row.closing_eur } : null;
    return { balance };
  });
}

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';

export const QUICK_CATEGORY_COUNT = 5;

export interface CategoryDto {
  categoryId: number;
  techName: string;
  displayName: string;
  sortOrder: number;
}

/** One category with its live expenses across all months, for the delete warning. */
export interface CategoryWithTotalsDto extends CategoryDto {
  expenseCount: number;
  /** Decimal string, '0.00' without expenses. */
  totalEur: string;
}

const CategoryParams = z.object({ categoryId: z.coerce.number().int().positive() });

function toDto(r: RowDataPacket): CategoryDto {
  return { categoryId: r.category_id, techName: r.tech_name, displayName: r.display_name, sortOrder: r.sort_order };
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

export async function categoryRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };

  app.get('/api/ledgers/:id/categories', guards, async (req) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, c.display_name, c.sort_order, u.last_used_at
           FROM categories c
           LEFT JOIN (
             SELECT category_id, MAX(created_at) AS last_used_at
               FROM expenses
              WHERE deleted_at IS NULL
              GROUP BY category_id
           ) u ON u.category_id = c.category_id
          WHERE c.ledger_id = ? AND c.deleted_at IS NULL
          ORDER BY c.sort_order, c.category_id`,
      [req.ledger!.ledgerId],
    );

    const categories = rows.map(toDto);
    const quickCategoryIds = pickQuick(
      rows.map((r) => ({ categoryId: r.category_id, sortOrder: r.sort_order, lastUsedAt: r.last_used_at })),
    );
    return { categories, quickCategoryIds };
  });

  app.get('/api/ledgers/:id/categories/:categoryId', guards, async (req, reply) => {
    const { categoryId } = CategoryParams.parse(req.params);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.category_id, c.tech_name, c.display_name, c.sort_order,
              COUNT(e.expense_id) AS expense_count, COALESCE(SUM(e.amount_eur), 0) AS total_eur
         FROM categories c
         LEFT JOIN expenses e ON e.category_id = c.category_id AND e.deleted_at IS NULL
        WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL
        GROUP BY c.category_id`,
      [categoryId, req.ledger!.ledgerId],
    );
    const r = rows[0];
    if (!r) return reply.code(404).send({ error: 'not_found' });
    const dto: CategoryWithTotalsDto = { ...toDto(r), expenseCount: r.expense_count, totalEur: r.total_eur };
    return dto;
  });
}

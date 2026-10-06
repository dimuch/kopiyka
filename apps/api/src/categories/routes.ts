import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { AppDeps } from '../app.js';

export const QUICK_CATEGORY_COUNT = 5;

export interface CategoryDto {
  categoryId: number;
  techName: string;
  displayName: string;
  sortOrder: number;
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
  app.get(
    '/api/ledgers/:id/categories',
    { preHandler: [app.requireAuth, app.requireLedger] },
    async (req) => {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT c.category_id, c.tech_name, c.display_name, c.sort_order, u.last_used_at
           FROM categories c
           LEFT JOIN (
             SELECT category_id, MAX(created_at) AS last_used_at
               FROM expenses
              WHERE deleted_at IS NULL
              GROUP BY category_id
           ) u ON u.category_id = c.category_id
          WHERE c.ledger_id = ? AND c.is_active = 1
          ORDER BY c.sort_order, c.category_id`,
        [req.ledger!.ledgerId],
      );

      const categories: CategoryDto[] = rows.map((r) => ({
        categoryId: r.category_id,
        techName: r.tech_name,
        displayName: r.display_name,
        sortOrder: r.sort_order,
      }));
      const quickCategoryIds = pickQuick(
        rows.map((r) => ({ categoryId: r.category_id, sortOrder: r.sort_order, lastUsedAt: r.last_used_at })),
      );
      return { categories, quickCategoryIds };
    },
  );
}

import type { FastifyBaseLogger } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { NotionScope } from '../config.js';
import { type Db, withTransaction } from '../db.js';
import { centsToString, toCents } from '../money.js';
import { type ExpensesTable, type ExpensesTemplate, type MonthView, NotionError } from './client.js';
import { yearBounds } from './groceries.js';

/** A live non-grocery expense of the synced ledger and year that Notion's totals don't include yet. */
export interface UncountedExpense {
  expenseId: number;
  categoryId: number;
  techName: string;
  /** 'YYYY-MM', from expense_date. */
  month: string;
  /** Decimal string, '12.30'. */
  amountEur: string;
  /** Claimed by an add that isn't confirmed yet: maybe in Notion, so it's never planned again. */
  pending: boolean;
}

/** The live non-grocery expenses of the scope, as SQL shared by the loader and the starting point. */
const IN_SCOPE = `c.ledger_id = ? AND c.tech_name <> 'groceries' AND c.deleted_at IS NULL AND e.deleted_at IS NULL
                  AND e.expense_date >= ? AND e.expense_date < ?`;

export async function loadUncounted(db: Db, scope: NotionScope): Promise<UncountedExpense[]> {
  const [from, to] = yearBounds(scope.year);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.expense_id, e.category_id, c.tech_name, e.expense_date, e.amount_eur, n.expense_id AS counted
       FROM expenses e
       JOIN categories c ON c.category_id = e.category_id
       LEFT JOIN notion_counted_expenses n ON n.expense_id = e.expense_id
       LEFT JOIN notion_total_adds a ON a.add_id = n.add_id
      WHERE ${IN_SCOPE} AND (n.expense_id IS NULL OR a.confirmed = 0)
      ORDER BY e.expense_date, e.expense_id`,
    [scope.ledgerId, from, to],
  );
  return rows.map((r) => ({
    expenseId: r.expense_id,
    categoryId: r.category_id,
    techName: r.tech_name,
    month: (r.expense_date as string).slice(0, 7),
    amountEur: r.amount_eur,
    pending: r.counted !== null,
  }));
}

/**
 * Records every live non-grocery expense of the scope as already in Notion's totals (the user typed them in by hand)
 * and stamps totals_started_at. Deleted expenses aren't recorded, so restoring one later adds it. Returns how many
 * were recorded; throws, writing nothing, if the starting point is already set.
 */
export async function startTotals(db: Db, scope: NotionScope, now: Date): Promise<number> {
  const [from, to] = yearBounds(scope.year);
  return withTransaction(db, async (conn) => {
    const [started] = await conn.query<RowDataPacket[]>(
      'SELECT 1 FROM notion_syncs WHERE ledger_id = ? AND totals_started_at IS NOT NULL FOR UPDATE',
      [scope.ledgerId],
    );
    if (started.length) throw new Error('The totals starting point is already set.');
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO notion_counted_expenses (expense_id)
       SELECT e.expense_id FROM expenses e JOIN categories c ON c.category_id = e.category_id WHERE ${IN_SCOPE}`,
      [scope.ledgerId, from, to],
    );
    await conn.query(
      `INSERT INTO notion_syncs (ledger_id, totals_started_at) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE totals_started_at = ?`,
      [scope.ledgerId, now, now],
    );
    return res.affectedRows;
  });
}

/** One category-month's add: its new expenses' sum, rounded half up to whole euros. */
export interface TotalAdd {
  categoryId: number;
  techName: string;
  /** 'YYYY-MM'. */
  month: string;
  euros: bigint;
  expenseIds: number[];
}

/** Groups new expenses by category and month, ordered by month then tech_name; each sum rounds half up. */
export function planTotals(expenses: UncountedExpense[]): TotalAdd[] {
  const groups = new Map<string, { add: Omit<TotalAdd, 'euros'>; cents: bigint }>();
  for (const e of expenses) {
    const key = `${e.month} ${e.techName}`;
    const group = groups.get(key) ?? {
      add: { categoryId: e.categoryId, techName: e.techName, month: e.month, expenseIds: [] },
      cents: 0n,
    };
    group.add.expenseIds.push(e.expenseId);
    group.cents += toCents(e.amountEur);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, { add, cents }]) => ({ ...add, euros: (cents + 50n) / 100n }));
}

/** Notion's other spellings of a category, besides its tech_name read with spaces. */
const ALIASES: Record<string, string[]> = {
  utilities: ['utilites'], // October's row in Budget ’26
  parking: ['car parking'], // Jan–Aug
  gift: ['gifts'], // Jan–May
};

/** The lower-case Notion Category titles a tech_name matches. */
export function notionNames(techName: string): string[] {
  return [techName.replaceAll('_', ' '), ...(ALIASES[techName] ?? [])];
}

/** Whether a Notion Category title names the tech_name, ignoring case and surrounding spaces. */
function matches(title: string, techName: string): boolean {
  return notionNames(techName).includes(title.trim().toLowerCase());
}

/** The category's row with the latest Month (rows without one are skipped; ties keep the first); null when none. */
export function latestTemplate(rows: ExpensesTemplate[], techName: string): ExpensesTemplate | null {
  let latest: ExpensesTemplate | null = null;
  for (const row of rows) {
    if (row.month === null || !matches(row.category, techName)) continue;
    if (!latest || row.month > (latest.month ?? 0)) latest = row;
  }
  return latest;
}

export interface TotalsResult {
  /** Adds Notion confirmed in this run: a recovered one and a new one of the same category-month count twice. */
  added: number;
  failed: Array<{ category: string; month: string; error: string }>;
}

/**
 * Adds each category-month's new expenses to its row's Actual Amount, creating the row when the month has a Netto page
 * but no row for the category. Each add is recorded before the write and confirmed after it, so it's never made
 * twice; a failed step is listed and retried on the next sync.
 */
export async function syncTotals(
  db: Db,
  table: ExpensesTable,
  scope: NotionScope,
  log: Pick<FastifyBaseLogger, 'warn'>,
): Promise<TotalsResult> {
  const result: TotalsResult = { added: 0, failed: [] };
  await recover(db, table, scope, log, result);
  const unconfirmed = await unconfirmedMonths(db, scope);
  const months = new Map<string, Promise<MonthView | null>>();
  // One read of the whole table per run, and only when a row must be created; a failure repeats for the run's other
  // creates and is retried on the next sync.
  let templates: Promise<ExpensesTemplate[]> | undefined;
  const allTemplates = () => (templates ??= table.allRows());

  for (const add of planTotals((await loadUncounted(db, scope)).filter((e) => !e.pending))) {
    const fail = (error: string) => result.failed.push({ category: add.techName, month: add.month, error });
    // Never build on an add that might not have landed: its expenses would be under-counted. recover() has listed it.
    if (unconfirmed.has(`${add.categoryId} ${add.month}`)) continue;
    try {
      if (!months.has(add.month)) months.set(add.month, table.monthRows(add.month));
      const view = await months.get(add.month)!;
      // Netto pages also hold income and balances, which kopiyka doesn't know, so it never makes one.
      if (!view) {
        fail('no_netto_page');
        continue;
      }
      const rows = view.rows.filter((r) => matches(r.category, add.techName));
      if (rows.length > 1) {
        fail('duplicate_rows');
        continue;
      }
      if (add.euros === 0n) {
        await countExpenses(db, add.expenseIds, null);
        continue;
      }
      const pageId = rows[0]?.pageId ?? (await createMissingRow(table, add, view.nettoPageId, allTemplates));
      await addToRow(db, table, add, pageId);
      result.added++;
    } catch (err) {
      log.warn({ err, category: add.techName, month: add.month }, 'Notion totals step failed');
      fail(err instanceof NotionError ? err.code : 'internal');
    }
  }
  return result;
}

/**
 * Settles each add a previous run left unconfirmed by reading its row back: the expected amount means it landed,
 * the base means it didn't (its expenses are planned again), anything else is a hand edit, kept and reported once.
 */
async function recover(
  db: Db,
  table: ExpensesTable,
  scope: NotionScope,
  log: Pick<FastifyBaseLogger, 'warn'>,
  result: TotalsResult,
): Promise<void> {
  const [open] = await db.query<RowDataPacket[]>(
    `SELECT a.add_id, a.notion_page_id, a.base_amount, a.expected_amount, c.tech_name,
            DATE_FORMAT(a.add_month, '%Y-%m') AS month
       FROM notion_total_adds a JOIN categories c ON c.category_id = a.category_id
      WHERE c.ledger_id = ? AND a.confirmed = 0
      ORDER BY a.add_id`,
    [scope.ledgerId],
  );
  for (const a of open) {
    const fail = (error: string) => result.failed.push({ category: a.tech_name, month: a.month, error });
    const confirm = () => db.query('UPDATE notion_total_adds SET confirmed = 1 WHERE add_id = ?', [a.add_id]);
    try {
      const current = (await table.actualCents(a.notion_page_id)) ?? 0n;
      if (current === signedCents(a.expected_amount)) {
        await confirm();
        result.added++;
      } else if (current === signedCents(a.base_amount)) {
        await release(db, a.add_id);
      } else {
        await confirm(); // never add it twice
        fail('actual_amount_changed');
      }
    } catch (err) {
      if (err instanceof NotionError && err.code === 'object_not_found') {
        // The row is gone, so the add can't be there.
        const released = await release(db, a.add_id).then(
          () => true,
          (releaseErr: unknown) => {
            log.warn({ err: releaseErr, category: a.tech_name, month: a.month }, 'Notion totals release failed');
            return false;
          },
        );
        if (!released) fail('internal');
        continue;
      }
      log.warn({ err, category: a.tech_name, month: a.month }, 'Notion totals read-back failed');
      fail(err instanceof NotionError ? err.code : 'internal');
    }
  }
}

/** Cents of a stored DECIMAL, which can be negative when Notion's Actual Amount was (toCents takes no sign). */
function signedCents(amount: string): bigint {
  return amount.startsWith('-') ? -toCents(amount.slice(1)) : toCents(amount);
}

/** Forgets an add that didn't land, so its expenses count as new again. */
async function release(db: Db, addId: number): Promise<void> {
  await withTransaction(db, async (conn) => {
    await conn.query('DELETE FROM notion_counted_expenses WHERE add_id = ?', [addId]);
    await conn.query('DELETE FROM notion_total_adds WHERE add_id = ?', [addId]);
  });
}

/** The scope's category-months ('<categoryId> YYYY-MM') with an add Notion hasn't confirmed. */
async function unconfirmedMonths(db: Db, scope: NotionScope): Promise<Set<string>> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT a.category_id, DATE_FORMAT(a.add_month, '%Y-%m') AS month
       FROM notion_total_adds a JOIN categories c ON c.category_id = a.category_id
      WHERE c.ledger_id = ? AND a.confirmed = 0`,
    [scope.ledgerId],
  );
  return new Set(rows.map((r) => `${r.category_id} ${r.month}`));
}

async function countExpenses(db: Db, expenseIds: number[], addId: number | null): Promise<void> {
  await db.query('INSERT INTO notion_counted_expenses (expense_id, add_id) VALUES ?', [
    expenseIds.map((id) => [id, addId]),
  ]);
}

/**
 * Makes the category's row for a month that has none, linked to the month's Netto page, with Budget and Type copied
 * from the category's latest row. Actual Amount stays empty, so the add that follows is recorded from base 0: if this
 * answer is lost, the next sync finds the empty row in the month's view and adds to it instead of making another.
 */
async function createMissingRow(
  table: ExpensesTable,
  add: TotalAdd,
  nettoPageId: string,
  templates: () => Promise<ExpensesTemplate[]>,
): Promise<string> {
  const template = latestTemplate(await templates(), add.techName);
  return table.createRow({
    category: template?.category ?? add.techName.replaceAll('_', ' '),
    month: add.month,
    nettoPageId,
    budgetCents: template?.budgetCents ?? null,
    type: template?.type ?? null,
  });
}

/** Records the add with the row's fresh base, writes base + the add, then confirms it. */
async function addToRow(db: Db, table: ExpensesTable, add: TotalAdd, pageId: string): Promise<void> {
  const base = (await table.actualCents(pageId)) ?? 0n;
  const expected = base + add.euros * 100n;
  const addId = await withTransaction(db, async (conn) => {
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO notion_total_adds (category_id, add_month, notion_page_id, base_amount, expected_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [add.categoryId, `${add.month}-01`, pageId, centsToString(base), centsToString(expected)],
    );
    await conn.query('INSERT INTO notion_counted_expenses (expense_id, add_id) VALUES ?', [
      add.expenseIds.map((id) => [id, res.insertId]),
    ]);
    return res.insertId;
  });
  await table.setActualCents(pageId, expected);
  await db.query('UPDATE notion_total_adds SET confirmed = 1 WHERE add_id = ?', [addId]);
}

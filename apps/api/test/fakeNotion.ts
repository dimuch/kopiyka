import { type ExpensesTable, type GroceriesTable, type GroceryRow, NotionError } from '../src/notion/client.js';

type FakePage = { props: GroceryRow | { foreign: string }; inTrash: boolean };

/** An in-memory Notion Groceries table that behaves like the real one where sync depends on it. */
export interface FakeNotion extends GroceriesTable {
  pages: Map<string, FakePage>;
  /** Every call, e.g. 'create 57', 'update <pageId>'. */
  calls: string[];
  /** Store the next created row, then throw as if the answer was lost. */
  failAfterCreate: boolean;
  /** Fail calls on these page ids with this error. */
  failOn: Map<string, NotionError>;
  /** Every call waits for this first. */
  gate: Promise<void> | null;
}

export function pageId(n: number): string {
  return n.toString(16).padStart(32, '0');
}

export function fakeNotion(): FakeNotion {
  let next = 0x1000;
  const fake: FakeNotion = {
    pages: new Map(),
    calls: [],
    failAfterCreate: false,
    failOn: new Map(),
    gate: null,
    async find(expenseId) {
      await call(`find ${expenseId}`);
      // Like the real client: rows in trash don't count.
      for (const [id, page] of fake.pages) {
        if (!page.inTrash && 'expenseId' in page.props && page.props.expenseId === expenseId) return id;
      }
      return null;
    },
    async create(row) {
      await call(`create ${row.expenseId}`);
      const id = pageId(next++);
      fake.pages.set(id, { props: { ...row }, inTrash: false });
      if (fake.failAfterCreate) {
        fake.failAfterCreate = false;
        throw new NotionError(0, 'notion_unreachable');
      }
      return id;
    },
    async update(id, row) {
      await call(`update ${id}`, id);
      const page = existing(id);
      // Notion refuses to edit a page in trash.
      if (page.inTrash) throw new NotionError(400, 'validation_error');
      page.props = { ...row };
    },
    async setInTrash(id, inTrash) {
      await call(`setInTrash ${id} ${inTrash}`, id);
      const page = existing(id);
      // Like real Notion (checked 2026-10-13): trashing a page already in trash is refused; restoring a live one isn't.
      if (inTrash && page.inTrash) throw new NotionError(400, 'validation_error');
      page.inTrash = inTrash;
    },
    async isInTrash(id) {
      await call(`isInTrash ${id}`, id);
      return existing(id).inTrash;
    },
  };

  async function call(name: string, id?: string) {
    fake.calls.push(name);
    if (fake.gate) await fake.gate;
    const err = id && fake.failOn.get(id);
    if (err) throw err;
  }

  function existing(id: string): FakePage {
    const page = fake.pages.get(id);
    if (!page) throw new NotionError(404, 'object_not_found');
    return page;
  }

  return fake;
}

type FakeExpensesRow = {
  category: string;
  month: string;
  inView: boolean;
  actualCents: bigint | null;
  budgetCents?: bigint | null;
  type?: string | null;
  nettoPageId?: string;
};

/** An in-memory Notion Expenses table: one row per category per month, with Actual Amount in cents. */
export interface FakeExpenses extends ExpensesTable {
  rows: Map<string, FakeExpensesRow>;
  calls: string[];
  /** Store the next written value, then throw as if the answer was lost. */
  failAfterSet: boolean;
  /** Refuse the next write before storing anything. */
  failBeforeSet: boolean;
  /** Fail actualCents / setActualCents on these page ids. */
  failOn: Map<string, NotionError>;
  /** Fail monthRows for these 'YYYY-MM' months. */
  failMonth: Map<string, NotionError>;
  /** 'YYYY-MM' months the Netto table has no page for. */
  missingNetto: Set<string>;
  /** Store the next created row, then throw as if the answer was lost. */
  failAfterCreate: boolean;
}

/** The fake Netto page of a 'YYYY-MM' month, e.g. pageId(202610). */
export function nettoPage(month: string): string {
  return pageId(Number(month.replace('-', '')));
}

export function fakeExpenses(): FakeExpenses {
  let nextRow = 0x9000;
  const fake: FakeExpenses = {
    rows: new Map(),
    calls: [],
    failAfterSet: false,
    failBeforeSet: false,
    failOn: new Map(),
    failMonth: new Map(),
    missingNetto: new Set(),
    failAfterCreate: false,
    async allRows() {
      fake.calls.push('allRows');
      // inView: false rows come back too: here that flag stands for both "in trash" and "live but not in the view",
      // while the real client skips trashed rows. No sync test depends on the difference.
      return [...fake.rows.values()].map((r) => ({
        category: r.category,
        month: Number(r.month.slice(5, 7)),
        budgetCents: r.budgetCents ?? null,
        type: r.type ?? null,
      }));
    },
    async createRow(row) {
      fake.calls.push(`createRow ${row.category} ${row.month}`);
      const id = pageId(nextRow++);
      fake.rows.set(id, {
        category: row.category,
        month: row.month,
        // Models the view's relation filter: the row shows only when it relates to the month's Netto page.
        inView: row.nettoPageId === nettoPage(row.month) && !fake.missingNetto.has(row.month),
        actualCents: null,
        budgetCents: row.budgetCents,
        type: row.type,
        nettoPageId: row.nettoPageId,
      });
      if (fake.failAfterCreate) {
        fake.failAfterCreate = false;
        throw new NotionError(0, 'notion_unreachable');
      }
      return id;
    },
    async monthRows(month) {
      fake.calls.push(`monthRows ${month}`);
      const err = fake.failMonth.get(month);
      if (err) throw err;
      if (fake.missingNetto.has(month)) return null;
      // inView models the month view's relation filter and trash.
      const rows = [...fake.rows]
        .filter(([, r]) => r.month === month && r.inView)
        .map(([pageId, r]) => ({ pageId, category: r.category }));
      return { nettoPageId: nettoPage(month), rows };
    },
    async actualCents(id) {
      fake.calls.push(`actualCents ${id}`);
      const err = fake.failOn.get(id);
      if (err) throw err;
      const row = fake.rows.get(id);
      if (!row) throw new NotionError(404, 'object_not_found');
      return row.actualCents;
    },
    async setActualCents(id, cents) {
      fake.calls.push(`setActualCents ${id} ${cents}`);
      const err = fake.failOn.get(id);
      if (err) throw err;
      const row = fake.rows.get(id);
      if (!row) throw new NotionError(404, 'object_not_found');
      if (fake.failBeforeSet) {
        fake.failBeforeSet = false;
        throw new NotionError(0, 'notion_unreachable');
      }
      row.actualCents = cents;
      if (fake.failAfterSet) {
        fake.failAfterSet = false;
        throw new NotionError(0, 'notion_unreachable');
      }
    },
  };
  return fake;
}

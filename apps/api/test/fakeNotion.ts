import { type GroceriesTable, type GroceryRow, NotionError } from '../src/notion/client.js';

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
      existing(id).inTrash = inTrash; // the same state again succeeds
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

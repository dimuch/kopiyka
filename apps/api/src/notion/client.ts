/** What kopiyka writes to a Groceries row. amountEur is a decimal string ('29.10'); date is 'YYYY-MM-DD'. */
export interface GroceryRow {
  expenseId: number;
  name: string;
  amountEur: string;
  date: string;
}

/** The Notion Groceries table of the synced year. Page ids are 32 lowercase hex digits. */
export interface GroceriesTable {
  /** The live row whose Kopiyka ID is expenseId, or null. */
  find(expenseId: number): Promise<string | null>;
  create(row: GroceryRow): Promise<string>;
  /** Sets Name, Amount, Date, Month and Kopiyka ID; other columns are untouched. */
  update(pageId: string, row: GroceryRow): Promise<void>;
  /** Notion refuses to move a page to the state it's already in (validation_error). */
  setInTrash(pageId: string, inTrash: boolean): Promise<void>;
  isInTrash(pageId: string): Promise<boolean>;
}

/** A row in one month's view of the Notion Expenses table. */
export interface ExpensesRow {
  pageId: string;
  category: string;
}

/** The Notion Expenses table of the synced year, one row per category per month. Page ids are 32 lowercase hex. */
export interface ExpensesTable {
  /** The month's live rows: Month is its short name and they relate to the month's Netto page. month is 'YYYY-MM'. */
  monthRows(month: string): Promise<ExpensesRow[]>;
  /** A row's Actual Amount in cents; null when empty. */
  actualCents(pageId: string): Promise<bigint | null>;
  /** Writes Actual Amount only; other columns are untouched. */
  setActualCents(pageId: string, cents: bigint): Promise<void>;
}

/** A failed Notion call: Notion's error code ('object_not_found', 'rate_limited', …) or 'notion_unreachable'. */
export class NotionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = `Notion answered ${status} ${code}`,
  ) {
    super(message);
    this.name = 'NotionError';
  }
}

const API = 'https://api.notion.com/v1';
const VERSION = '2026-03-11'; // where `archived` became `in_trash`
const SPACING_MS = 334; // Notion allows about 3 requests a second
const ATTEMPTS = 3;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface NotionApiConfig {
  token: string;
  /** The Groceries data source: the UUID in its `collection://…` URL. */
  groceriesDataSourceId: string;
}

interface ClientDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** The Notion Groceries table over Notion's REST API, spacing requests out and waiting out rate limits. */
export function notionClient(
  { token, groceriesDataSourceId }: NotionApiConfig,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => performance.now(), // monotonic, so a clock change can't stall requests
  }: ClientDeps = {},
): GroceriesTable {
  const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' };
  let nextAt = 0;

  async function request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    for (let attempt = 1; ; attempt++) {
      const t = now();
      if (t < nextAt) await sleep(nextAt - t);
      nextAt = Math.max(t, nextAt) + SPACING_MS;

      let res: Response;
      try {
        res = await fetchImpl(`${API}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new NotionError(0, 'notion_unreachable');
      }
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      if ((res.status === 429 || res.status === 529) && attempt < ATTEMPTS) {
        await res.body?.cancel(); // free the connection before waiting
        await sleep((Number(res.headers.get('Retry-After')) || 1) * 1000);
        continue;
      }
      // Notion's error bodies carry `code`; a proxy's HTML page doesn't.
      const error = (await res.json().catch(() => null)) as { code?: unknown } | null;
      const code = typeof error?.code === 'string' ? error.code : 'notion_error';
      throw new NotionError(res.status, code);
    }
  }

  function pageId(id: unknown): string {
    const normalised = String(id).replaceAll('-', '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(normalised))
      throw new NotionError(200, 'bad_response', 'Notion answered without a page id');
    return normalised;
  }

  function properties(row: GroceryRow) {
    return {
      Name: { title: [{ text: { content: row.name } }] },
      Amount: { number: Number(row.amountEur) },
      Date: { date: { start: row.date } },
      Month: { select: { name: MONTHS[Number(row.date.slice(5, 7)) - 1] } },
      'Kopiyka ID': { number: row.expenseId },
    };
  }

  return {
    async find(expenseId) {
      const answer = await request('POST', `/data_sources/${groceriesDataSourceId}/query`, {
        filter: { property: 'Kopiyka ID', number: { equals: expenseId } },
        page_size: 10,
      });
      // The docs only promise to leave out archived pages, not ones in trash, so skip those here.
      const results = (answer.results ?? []) as Array<{ id: string; in_trash?: boolean }>;
      const live = results.find((r) => !r.in_trash);
      return live ? pageId(live.id) : null;
    },
    async create(row) {
      const answer = await request('POST', '/pages', {
        parent: { type: 'data_source_id', data_source_id: groceriesDataSourceId },
        properties: properties(row),
      });
      return pageId(answer.id);
    },
    async update(id, row) {
      await request('PATCH', `/pages/${id}`, { properties: properties(row) });
    },
    async setInTrash(id, inTrash) {
      await request('PATCH', `/pages/${id}`, { in_trash: inTrash });
    },
    async isInTrash(id) {
      const page = await request('GET', `/pages/${id}`);
      return page.in_trash === true;
    },
  };
}

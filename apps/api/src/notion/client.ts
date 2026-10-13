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
  setInTrash(pageId: string, inTrash: boolean): Promise<void>;
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

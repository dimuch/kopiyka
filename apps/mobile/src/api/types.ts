// Shapes returned by apps/api.

export type Currency = 'EUR' | 'UAH';

export interface User {
  userId: number;
  username: string;
}

export interface Ledger {
  ledgerId: number;
  name: string;
  role: 'owner' | 'member';
}

export interface Category {
  categoryId: number;
  techName: string;
  displayName: string;
  sortOrder: number;
}

/** One category with its live expenses in one month, and whether that month's list has it (GET one ?month=). */
export interface CategoryWithTotals extends Category {
  expenseCount: number;
  /** Decimal string, '0.00' without expenses. */
  totalEur: string;
  /** False when the month's list lacks it; it then has no expenses there. */
  inMonth: boolean;
}

export interface Expense {
  expenseId: number;
  categoryId: number;
  expenseDate: string;
  name: string;
  amountEur: string;
  amountUah: string;
  eurUahRate: string;
  enteredCurrency: 'EUR' | 'UAH';
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface EurUahRate {
  /** The date asked for. */
  date: string;
  /** The NBU's date for the rate; earlier than `date` when the API fell back to the latest published one. */
  rateDate: string;
  /** 1 EUR in UAH, 4 decimals. */
  eurUah: number;
}

export interface NotionStatus {
  /** Expenses Notion hasn't heard about yet: grocery changes plus uncounted category spending. */
  unsent: number;
  /** ISO time of the last sync that finished without failures; null before the first. */
  lastSyncedAt: string | null;
}

export interface GroceryFailure {
  expenseId: number;
  name: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  error: string;
}

export interface TotalsFailure {
  /** The category's tech_name. */
  category: string;
  /** 'YYYY-MM'. */
  month: string;
  error: string;
}

export interface NotionSyncResult {
  groceries: { created: number; updated: number; trashed: number; failed: GroceryFailure[] };
  /** null when the API has no Expenses table configured. */
  totals: { added: number; failed: TotalsFailure[] } | null;
}

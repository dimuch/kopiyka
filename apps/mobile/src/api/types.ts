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
  /** The owner's username: until a label is set, every ledger shows as "Home", so this tells them apart. */
  owner: string;
  /** The user's own label for it (brief 056); null shows the default. */
  label: string | null;
}

/** Someone in a ledger, as its owner sees them on the Members screen. */
export interface Member {
  userId: number;
  username: string;
  role: 'owner' | 'member';
}

/** Someone invited to the open ledger, as its owner sees them; the invite is live for an hour. */
export interface PendingInvite {
  inviteId: number;
  username: string;
}

/** An invite to the signed-in user, live for an hour after it's sent. */
export interface Invite {
  inviteId: number;
  ledgerId: number;
  /** Every ledger is named "Home"; `owner` tells them apart. */
  ledgerName: string;
  owner: string;
}

export interface LedgerMembers {
  members: Member[];
  invites: PendingInvite[];
}

export interface Category {
  categoryId: number;
  techName: string;
  displayName: string;
  /** The ledger's order. A list comes in the caller's own order instead (brief 092). */
  sortOrder: number;
  /** The month's planned EUR (brief 036): a decimal string ≥ 0, '0.00' when none is set. */
  plannedEur: string;
  /**
   * The category's icon key (brief 114), the same in every month; null shows the letter. Not a union of the keys this
   * build draws: the API may know newer ones, which then show the letter too.
   */
  icon: string | null;
}

/** A month's balances (briefs 090, 102): signed decimal strings, '-180.00'. The month runs from opening to closing. */
export interface MonthBalance {
  openingEur: string;
  /** The End the line shows: an actual End set by hand, else the stored or worked-out one (brief 102). */
  closingEur: string;
  /** The End was set by hand. */
  actual: boolean;
}

/** A ledger's income item in one month (brief 058); any member edits or deletes it. */
export interface IncomeItem {
  incomeId: number;
  title: string;
  /** Decimal string > 0, as stored: '2500.00'. */
  amountEur: string;
  /** Username of the member who added it (or copied it in); an edit by someone else doesn't change it. */
  addedBy: string;
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

/** The names already used in a category, best first (brief 108). */
export interface ExpenseNames {
  names: string[];
}

export interface EurUahRate {
  /** The date asked for. */
  date: string;
  /** The NBU's date for the rate; earlier than `date` when the API fell back to the latest published one. */
  rateDate: string;
  /** 1 EUR in UAH, 4 decimals. */
  eurUah: number;
}

/** A period's figures in EUR (brief 089), as decimal strings. `leftEur` is income − spent and may be negative. */
export interface SummaryTotals {
  incomeEur: string;
  plannedEur: string;
  spentEur: string;
  leftEur: string;
}

/** One month of a period; a month with nothing in it is all '0.00'. `leftEur` may be negative. */
export interface SummaryMonth {
  /** 'YYYY-MM'. */
  month: string;
  incomeEur: string;
  spentEur: string;
  leftEur: string;
}

/** A category's planned and spent over a period, named as in the period's last month. */
export interface SummaryCategory {
  categoryId: number;
  name: string;
  plannedEur: string;
  spentEur: string;
}

/** GET /api/ledgers/:id/summary: months oldest first, categories by spent (largest first). */
export interface PeriodSummary {
  totals: SummaryTotals;
  months: SummaryMonth[];
  categories: SummaryCategory[];
}

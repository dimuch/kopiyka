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

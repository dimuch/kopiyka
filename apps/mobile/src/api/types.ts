// Shapes returned by apps/api.

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

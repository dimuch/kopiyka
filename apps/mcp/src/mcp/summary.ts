import { eur, toCents } from '../money.js';

export interface ApiCategory {
  categoryId: number;
  displayName: string;
  plannedEur: string;
}

interface ExpenseAmount {
  categoryId: number;
  amountEur: string;
}

interface IncomeAmount {
  amountEur: string;
}

export const sumCents = (amounts: { amountEur: string }[]) =>
  amounts.reduce((total, { amountEur }) => total + toCents(amountEur), 0n);

/** A month as the Budget and Expenses tabs show it: `left` is planned − spent, `leftToPlan` is income − planned. */
export function monthSummary(categories: ApiCategory[], expenses: ExpenseAmount[], income: IncomeAmount[]) {
  const rows = categories.map(({ categoryId, displayName, plannedEur }) => {
    const ofCategory = expenses.filter((expense) => expense.categoryId === categoryId);
    return { categoryId, name: displayName, planned: toCents(plannedEur), spent: sumCents(ofCategory), ofCategory };
  });
  const planned = rows.reduce((total, row) => total + row.planned, 0n);
  const spent = rows.reduce((total, row) => total + row.spent, 0n);
  const incomeTotal = sumCents(income);

  return {
    categories: rows.map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      planned: eur(row.planned),
      spent: eur(row.spent),
      left: eur(row.planned - row.spent),
      expenseCount: row.ofCategory.length,
    })),
    totals: { planned: eur(planned), spent: eur(spent), left: eur(planned - spent) },
    income: { total: eur(incomeTotal), leftToPlan: eur(incomeTotal - planned) },
  };
}

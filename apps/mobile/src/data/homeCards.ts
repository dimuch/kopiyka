import type { IncomeItem } from '@/api/types';
import type { HomeCard } from '@/components/HomeCards';
import { incomeCents, plannedCents, sumCents } from '@/data/monthSummary';
import type { MonthData } from '@/data/useMonth';
import { eur } from '@/format';

/**
 * Home's Income, Budget and Expenses cards for one month: a null figure while its load is pending, `failed` when that
 * load failed.
 */
export function moneyCards(
  month: { data: MonthData | null; error: boolean },
  income: { items: IncomeItem[] | null; error: boolean },
): HomeCard[] {
  const { data, error } = month;
  return [
    {
      title: 'Income',
      href: '/income',
      icon: 'income',
      // Like Budget's "Not set": no member has added income for the month yet.
      figure: !income.items ? null : income.items.length === 0 ? 'Not set' : eur(incomeCents(income.items)),
      failed: income.error,
    },
    {
      title: 'Budget',
      href: '/budget',
      icon: 'budget',
      // A month without categories has no budget (brief 034).
      figure: !data ? null : data.categories.length === 0 ? 'Not set' : eur(plannedCents(data.categories)),
      failed: error,
    },
    {
      title: 'Expenses',
      href: '/expenses',
      icon: 'expenses',
      figure: data ? eur(sumCents(data.expenses, 'amountEur')) : null,
      failed: error,
    },
  ];
}

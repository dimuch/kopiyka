import type { Currency } from '@/api/types';
import { kyivMonth, kyivToday, shiftMonth } from '@/format';
import { sampleAmounts } from './expenseRoutes';
import { DEMO_USER, type DemoExpense, plannedKey, type StoreData } from './state';

/** Invented categories with their planned EUR: €1,400 a month, so €350 of the €1,750 income is left to plan. */
const CATEGORIES = [
  { techName: 'rent', name: 'Rent', planned: 650_00 },
  { techName: 'groceries', name: 'Groceries', planned: 350_00 },
  { techName: 'transport', name: 'Transport', planned: 90_00 },
  { techName: 'eating_out', name: 'Eating out', planned: 140_00 },
  { techName: 'utilities', name: 'Utilities', planned: 110_00 },
  { techName: 'fun', name: 'Fun', planned: 60_00 },
];

const INCOME = [
  { title: 'Salary', amountEur: '1500.00' },
  { title: 'Side project', amountEur: '250.00' },
];

/** A month's expenses: day of the month, category (index in CATEGORIES), name, amount and the currency it's in. */
const EXPENSES: [number, number, string, string, Currency][] = [
  [1, 0, 'Rent', '650', 'EUR'],
  [2, 1, 'Market', '1450', 'UAH'],
  [4, 2, 'Metro card', '480', 'UAH'],
  [6, 3, 'Pizza with friends', '24.50', 'EUR'],
  [9, 1, 'Supermarket', '2310', 'UAH'],
  [11, 4, 'Electricity', '1890', 'UAH'],
  [14, 5, 'Cinema', '12', 'EUR'],
  [17, 3, 'Coffee', '160', 'UAH'],
  [21, 1, 'Bakery', '230', 'UAH'],
  [25, 2, 'Taxi', '310', 'UAH'],
];

/**
 * The demo's starting data at `now`: this month and last in Kyiv, with the same categories, plans and income, and
 * about ten expenses each. An expense whose day hasn't come yet this month is dated today, and none was created after
 * `now`, so the list and the quick row read as they would for a real person.
 */
export function sampleData(now: Date): StoreData {
  const today = kyivToday(now);
  const thisMonth = kyivMonth(now);
  const months = [shiftMonth(thisMonth, -1), thisMonth];
  const data: StoreData = { categories: [], monthRows: [], planned: new Map(), expenses: [], income: [], nextId: 1 };

  for (const [index, category] of CATEGORIES.entries()) {
    const categoryId = data.nextId++;
    data.categories.push({
      categoryId,
      techName: category.techName,
      displayName: category.name,
      sortOrder: (index + 1) * 10,
    });
    for (const month of months) {
      data.monthRows.push({ categoryId, month, displayName: category.name, removal: null });
      data.planned.set(plannedKey(categoryId, month), category.planned);
    }
  }

  for (const month of months) {
    for (const item of INCOME) {
      data.income.push({ incomeId: data.nextId++, month, ...item, addedBy: DEMO_USER.username });
    }
  }

  const count = months.length * EXPENSES.length;
  for (const [monthIndex, month] of months.entries()) {
    for (const [index, [day, categoryIndex, name, amount, currency]] of EXPENSES.entries()) {
      const order = monthIndex * EXPENSES.length + index;
      const dated = `${month}-${String(day).padStart(2, '0')}`;
      const expenseDate = dated < today ? dated : today;
      // Each one a minute after the last on its day, and never after `now`: one second apart, counting back from it.
      const madeAt = Math.min(
        Date.parse(`${expenseDate}T07:00:00.000Z`) + order * 60_000,
        now.getTime() - (count - order) * 1000,
      );
      const createdAt = new Date(madeAt).toISOString();
      const expense: DemoExpense = {
        expenseId: data.nextId++,
        categoryId: data.categories[categoryIndex]!.categoryId,
        expenseDate,
        name,
        ...sampleAmounts(amount, currency),
        enteredCurrency: currency,
        createdBy: DEMO_USER.userId,
        createdAt,
        updatedAt: createdAt,
        removal: null,
      };
      data.expenses.push(expense);
    }
  }
  return data;
}

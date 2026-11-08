import type { IncomeItem } from '@/api/types';
import { centsToInput, shiftMonth, toCents } from '@/format';
import { refuseOverIncome } from './incomeLimit';
import { DEMO_USER, type DemoIncome, refuse, refuseIfEnded, type Route, type StoreData } from './state';

const MONTH_INCOME = /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/income$/;
const INCOME_ITEM = /^\/api\/ledgers\/\d+\/income\/(\d+)$/;

/** The body the income form sends. */
interface IncomeInput {
  title: string;
  amount: string;
}

function toDto({ month: _month, ...item }: DemoIncome): IncomeItem {
  return item;
}

/** The API's `findChangeable`: an item that can change, else 404 or `month_ended`. */
function changeable(data: StoreData, incomeId: string, now: Date): DemoIncome {
  const item = data.income.find((candidate) => candidate.incomeId === Number(incomeId)) ?? refuse(404, 'not_found');
  refuseIfEnded(item.month, now);
  return item;
}

export const incomeRoutes: Route[] = [
  {
    method: 'GET',
    pattern: MONTH_INCOME,
    answer: (data, _request, [month]) => ({
      items: data.income
        .filter((item) => item.month === month)
        .sort((left, right) => left.incomeId - right.incomeId)
        .map(toDto),
    }),
  },
  {
    method: 'POST',
    pattern: MONTH_INCOME,
    answer: (data, { body, now }, [month = '']) => {
      const input = body as IncomeInput;
      refuseIfEnded(month, now);
      const item: DemoIncome = {
        incomeId: data.nextId++,
        month,
        title: input.title.trim(),
        amountEur: centsToInput(toCents(input.amount)),
        addedBy: DEMO_USER.username,
      };
      data.income.push(item);
      return toDto(item);
    },
  },
  {
    method: 'PUT',
    pattern: INCOME_ITEM,
    answer: (data, { body, now }, [incomeId = '']) => {
      const input = body as IncomeInput;
      const item = changeable(data, incomeId, now);
      const amountCents = toCents(input.amount);
      refuseOverIncome(data, item.month, { plannedCents: 0, incomeCents: amountCents - toCents(item.amountEur) });
      // Who added it stays.
      item.title = input.title.trim();
      item.amountEur = centsToInput(amountCents);
    },
  },
  {
    method: 'DELETE',
    pattern: INCOME_ITEM,
    answer: (data, { now }, [incomeId = '']) => {
      const item = changeable(data, incomeId, now);
      refuseOverIncome(data, item.month, { plannedCents: 0, incomeCents: -toCents(item.amountEur) });
      data.income = data.income.filter((candidate) => candidate !== item);
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/income\/copy$/,
    answer: (data, { now }, [month = '']) => {
      refuseIfEnded(month, now);
      if (data.income.some((item) => item.month === month)) refuse(409, 'income_exists');
      const previous = data.income
        .filter((item) => item.month === shiftMonth(month, -1))
        .sort((left, right) => left.incomeId - right.incomeId);
      if (previous.length === 0) refuse(409, 'no_previous_income');
      // Titles and amounts, since income usually repeats; the one copying becomes the one who added them.
      for (const item of previous) {
        data.income.push({ ...item, incomeId: data.nextId++, month, addedBy: DEMO_USER.username });
      }
    },
  },
];

import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ApiError } from '../api.js';
import { eur, toCents, uah } from '../money.js';
import { monthSummary, sumCents, type ApiCategory } from './summary.js';
import {
  ADD_INCOME_REFUSALS,
  addExpenseRefusals,
  ALREADY_SAVED_NOTE,
  DELETE_EXPENSE_REFUSALS,
  DELETE_INCOME_REFUSALS,
  DELETED_EXPENSE_NOTE,
  DELETED_INCOME_NOTE,
  UPDATE_EXPENSE_REFUSALS,
  UPDATE_INCOME_REFUSALS,
} from './refusals.js';

interface ApiLedgers {
  user: { username: string };
  ledgers: { ledgerId: number; name: string; role: string; owner: string; label: string | null }[];
}

interface ApiExpense {
  expenseId: number;
  categoryId: number;
  expenseDate: string;
  name: string;
  amountEur: string;
  amountUah: string;
  eurUahRate: string;
  enteredCurrency: string;
}

interface ApiRate {
  date: string;
  rateDate: string;
  eurUah: number;
}

interface ApiIncomeItem {
  incomeId: number;
  title: string;
  amountEur: string;
  addedBy: string;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

const LedgerMonth = {
  ledgerId: z.number().int().positive().describe('A ledgerId from list_ledgers'),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .describe('The month, as YYYY-MM'),
};

/** A write to the API: a POST or PUT always sends a body, a DELETE never does. */
export type WriteCall = [method: 'POST' | 'PUT', path: string, body: object] | [method: 'DELETE', path: string];

/** What one `/mcp` request may do: read and write as its user, and spend that user's tool calls. */
export interface RequestScope {
  read<T>(path: string): Promise<T>;
  /** The API decides what this token may write. */
  write<T>(...call: WriteCall): Promise<T>;
  /** Today in Kyiv, as 'YYYY-MM-DD'. */
  today(): string;
  /** Takes one tool call: 0 when allowed, otherwise the seconds until one is free. */
  takeToolCall(tool: string): number;
}

/** An expense as the write tools answer with it, amounts with their currency. */
function expenseFields(expense: ApiExpense) {
  return {
    expenseId: expense.expenseId,
    date: expense.expenseDate,
    name: expense.name,
    categoryId: expense.categoryId,
    amountEur: eur(toCents(expense.amountEur)),
    amountUah: uah(toCents(expense.amountUah)),
    enteredCurrency: expense.enteredCurrency,
    eurUahRate: expense.eurUahRate,
  };
}

/** An income item as the tools answer with it, its amount with its currency. */
function incomeFields(item: ApiIncomeItem) {
  return { incomeId: item.incomeId, title: item.title, amount: eur(toCents(item.amountEur)), addedBy: item.addedBy };
}

const errorResult = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true });

/** Runs a tool, handing a refusal or an API error to the LLM as a result it can read, not a protocol failure. */
async function toolResult(
  scope: RequestScope,
  tool: string,
  run: () => Promise<Record<string, unknown>>,
  refusals: Record<string, string> = {},
): Promise<CallToolResult> {
  const waitSeconds = scope.takeToolCall(tool);
  if (waitSeconds > 0) {
    return errorResult(`rate_limited: too many requests from this connection; try again in ${waitSeconds} s`);
  }
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await run()) }] };
  } catch (err) {
    if (err instanceof ApiError) {
      const sentence = refusals[err.code];
      return errorResult(sentence ? `${err.code}: ${sentence}` : err.code);
    }
    throw err;
  }
}

/** A server for one request: `scope` is its user's, so a tool can only reach what that user can. */
export function buildServer(scope: RequestScope): McpServer {
  const server = new McpServer({ name: 'kopiyka', version: '0.1.0' });

  server.registerTool(
    'list_ledgers',
    {
      description:
        'Lists the budgets (ledgers) the signed-in user can read. Use a ledgerId from here in the other tools. ' +
        'All amounts in a ledger are in EUR.',
      annotations: { readOnlyHint: true },
    },
    () =>
      toolResult(scope, 'list_ledgers', async () => {
        const { user, ledgers } = await scope.read<ApiLedgers>('/api/ledgers');
        return {
          user: { username: user.username },
          ledgers: ledgers.map(({ ledgerId, name, label, role, owner }) => ({
            ledgerId,
            name,
            label,
            role,
            owner,
            currency: 'EUR',
          })),
        };
      }),
  );

  server.registerTool(
    'month_summary',
    {
      description:
        'Sums up one month of a ledger: per category what was planned, spent and is left (negative = overspent), ' +
        'the totals, the income, and what is left to plan. All amounts are in EUR. Months are YYYY-MM.',
      inputSchema: LedgerMonth,
      annotations: { readOnlyHint: true },
    },
    ({ ledgerId, month }) =>
      toolResult(scope, 'month_summary', async () => {
        const [{ categories }, { expenses }, { items }] = await Promise.all([
          scope.read<{ categories: ApiCategory[] }>(`/api/ledgers/${ledgerId}/categories?month=${month}`),
          scope.read<{ expenses: ApiExpense[] }>(`/api/ledgers/${ledgerId}/expenses?month=${month}`),
          scope.read<{ items: ApiIncomeItem[] }>(`/api/ledgers/${ledgerId}/months/${month}/income`),
        ]);
        return { ledgerId, month, currency: 'EUR', ...monthSummary(categories, expenses, items) };
      }),
  );

  server.registerTool(
    'list_income',
    {
      description: 'Lists one month’s income in a ledger, with its total. All amounts are in EUR. Months are YYYY-MM.',
      inputSchema: LedgerMonth,
      annotations: { readOnlyHint: true },
    },
    ({ ledgerId, month }) =>
      toolResult(scope, 'list_income', async () => {
        const { items } = await scope.read<{ items: ApiIncomeItem[] }>(
          `/api/ledgers/${ledgerId}/months/${month}/income`,
        );
        return {
          ledgerId,
          month,
          total: eur(sumCents(items)),
          items: items.map(incomeFields),
        };
      }),
  );

  server.registerTool(
    'list_expenses',
    {
      description:
        'Lists one month’s expenses in a ledger, newest first, one page at a time. When nextOffset is a number, ' +
        'call again with it as offset for the next page. Amounts are in EUR and UAH. Months are YYYY-MM.',
      inputSchema: {
        ...LedgerMonth,
        categoryId: z.number().int().positive().optional().describe('Only this category, from month_summary'),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      },
      annotations: { readOnlyHint: true },
    },
    ({ ledgerId, month, categoryId, offset, limit }) =>
      toolResult(scope, 'list_expenses', async () => {
        const inCategory = categoryId ? `&categoryId=${categoryId}` : '';
        const [{ expenses }, { categories }] = await Promise.all([
          scope.read<{ expenses: ApiExpense[] }>(`/api/ledgers/${ledgerId}/expenses?month=${month}${inCategory}`),
          scope.read<{ categories: ApiCategory[] }>(`/api/ledgers/${ledgerId}/categories?month=${month}`),
        ]);
        const names = new Map(categories.map((category) => [category.categoryId, category.displayName]));
        const end = offset + limit;
        return {
          ledgerId,
          month,
          total: expenses.length,
          offset,
          limit,
          nextOffset: end < expenses.length ? end : null,
          expenses: expenses.slice(offset, end).map((expense) => ({
            expenseId: expense.expenseId,
            date: expense.expenseDate,
            name: expense.name,
            categoryId: expense.categoryId,
            categoryName: names.get(expense.categoryId),
            amountEur: eur(toCents(expense.amountEur)),
            amountUah: uah(toCents(expense.amountUah)),
            enteredCurrency: expense.enteredCurrency,
            eurUahRate: expense.eurUahRate,
          })),
        };
      }),
  );

  server.registerTool(
    'eur_uah_rate',
    {
      description: 'Gives today’s EUR to UAH rate from the National Bank of Ukraine, and the date it was published.',
      annotations: { readOnlyHint: true },
    },
    () =>
      toolResult(scope, 'eur_uah_rate', async () => {
        const { date, rateDate, eurUah } = await scope.read<ApiRate>(`/api/rates/eur-uah?date=${scope.today()}`);
        return { date, rateDate, eurUah, formatted: `1 EUR = ${eurUah.toFixed(4)} UAH` };
      }),
  );

  server.registerTool(
    'add_expense',
    {
      description:
        'Adds one expense to a ledger, and answers with what was saved. The other currency comes from the National ' +
        'Bank of Ukraine rate of the date. An identical call within 10 minutes adds nothing, so a retry with the same date is safe.',
      inputSchema: {
        ledgerId: LedgerMonth.ledgerId,
        categoryId: z.number().int().positive().describe('A categoryId from month_summary, for the month of the date'),
        date: z.string().optional().describe('The date, as YYYY-MM-DD. Leave it out for today in Kyiv'),
        name: z.string().describe('What it was, like "Silpo"'),
        amount: z.string().describe('A decimal string, like "12.50"'),
        currency: z.enum(['EUR', 'UAH']),
      },
      // Destructive though it only adds: Claude's docs promise a prompt only for destructive tools.
      annotations: { title: 'Add an expense', readOnlyHint: false, destructiveHint: true },
    },
    ({ ledgerId, categoryId, date, name, amount, currency }) => {
      const expenseDate = date ?? scope.today();
      return toolResult(
        scope,
        'add_expense',
        async () => {
          const saved = await scope.write<ApiExpense & { alreadySaved?: boolean }>(
            'POST',
            `/api/ledgers/${ledgerId}/expenses`,
            { categoryId, expenseDate, name, amount, currency },
          );
          return {
            ledgerId,
            ...expenseFields(saved),
            alreadySaved: saved.alreadySaved === true,
            ...(saved.alreadySaved ? { note: ALREADY_SAVED_NOTE } : {}),
          };
        },
        addExpenseRefusals(expenseDate),
      );
    },
  );

  server.registerTool(
    'update_expense',
    {
      description:
        'Changes one expense: its category, date, name and amount, and answers with what was saved. Pass every ' +
        'field, copying the unchanged ones from list_expenses. To keep the amount, pass amountUah.amount with UAH ' +
        'when enteredCurrency is UAH, else amountEur.amount with EUR. The other currency comes from the National ' +
        'Bank of Ukraine rate of the date. The same call repeated is safe.',
      inputSchema: {
        ledgerId: LedgerMonth.ledgerId,
        expenseId: z.number().int().positive().describe('An expenseId from list_expenses'),
        categoryId: z.number().int().positive().describe('A categoryId from month_summary, for the month of the date'),
        date: z.string().describe('The date, as YYYY-MM-DD'),
        name: z.string().describe('What it was, like "Silpo"; an empty name clears it'),
        amount: z.string().describe('A decimal string, like "12.50"'),
        currency: z.enum(['EUR', 'UAH']),
      },
      annotations: { title: 'Change an expense', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ ledgerId, expenseId, categoryId, date, name, amount, currency }) =>
      toolResult(
        scope,
        'update_expense',
        async () => {
          const saved = await scope.write<ApiExpense>('PUT', `/api/ledgers/${ledgerId}/expenses/${expenseId}`, {
            categoryId,
            expenseDate: date,
            name,
            amount,
            currency,
          });
          return { ledgerId, ...expenseFields(saved) };
        },
        UPDATE_EXPENSE_REFUSALS,
      ),
  );

  server.registerTool(
    'delete_expense',
    {
      description: `Deletes one expense, and answers with what was deleted. ${DELETED_EXPENSE_NOTE} The same call repeated is safe.`,
      inputSchema: {
        ledgerId: LedgerMonth.ledgerId,
        expenseId: z.number().int().positive().describe('An expenseId from list_expenses'),
      },
      annotations: { title: 'Delete an expense', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ ledgerId, expenseId }) =>
      toolResult(
        scope,
        'delete_expense',
        async () => {
          // The delete answers 204, so read the expense first to say what was deleted.
          const path = `/api/ledgers/${ledgerId}/expenses/${expenseId}`;
          const expense = await scope.read<ApiExpense>(path);
          await scope.write('DELETE', path);
          return { ledgerId, ...expenseFields(expense), note: DELETED_EXPENSE_NOTE };
        },
        DELETE_EXPENSE_REFUSALS,
      ),
  );

  server.registerTool(
    'add_income',
    {
      description:
        'Adds one income item, in EUR, to a month of a ledger, and answers with what was saved. Not safe to repeat: ' +
        'if an answer is lost, check list_income first.',
      inputSchema: {
        ...LedgerMonth,
        title: z.string().describe('What it is, like "Salary"'),
        amount: z.string().describe('A decimal string in EUR, like "2500.00"'),
      },
      annotations: { title: 'Add income', readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    ({ ledgerId, month, title, amount }) =>
      toolResult(
        scope,
        'add_income',
        async () => {
          const saved = await scope.write<ApiIncomeItem>('POST', `/api/ledgers/${ledgerId}/months/${month}/income`, {
            title,
            amount,
          });
          return { ledgerId, month, ...incomeFields(saved) };
        },
        ADD_INCOME_REFUSALS,
      ),
  );

  server.registerTool(
    'update_income',
    {
      description:
        'Changes one income item’s title and amount (EUR), and answers with what was saved. Pass both, copying the ' +
        'unchanged one from list_income. The same call repeated is safe.',
      inputSchema: {
        ledgerId: LedgerMonth.ledgerId,
        incomeId: z.number().int().positive().describe('An incomeId from list_income'),
        title: z.string().describe('What it is, like "Salary"'),
        amount: z.string().describe('A decimal string in EUR, like "2500.00"'),
      },
      annotations: { title: 'Change income', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ ledgerId, incomeId, title, amount }) =>
      toolResult(
        scope,
        'update_income',
        async () => {
          await scope.write('PUT', `/api/ledgers/${ledgerId}/income/${incomeId}`, { title, amount });
          // The API answers 204 once saved, and stores the title trimmed and the amount to the cent.
          return { ledgerId, incomeId, title: title.trim(), amount: eur(toCents(amount)) };
        },
        UPDATE_INCOME_REFUSALS,
      ),
  );

  server.registerTool(
    'delete_income',
    {
      description:
        'Deletes one income item for good, and answers with what was deleted. There is no Undo, in Claude or in the ' +
        'app, so confirm with the user first. The same call repeated is safe.',
      inputSchema: {
        ...LedgerMonth,
        incomeId: z.number().int().positive().describe('An incomeId from list_income for that month'),
      },
      annotations: { title: 'Delete income', readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ ledgerId, month, incomeId }) =>
      toolResult(
        scope,
        'delete_income',
        async () => {
          // There's no single-item read and the delete answers 204, so find the item in its month first.
          const { items } = await scope.read<{ items: ApiIncomeItem[] }>(
            `/api/ledgers/${ledgerId}/months/${month}/income`,
          );
          const item = items.find((candidate) => candidate.incomeId === incomeId);
          if (!item) throw new ApiError(404, 'not_found');
          await scope.write('DELETE', `/api/ledgers/${ledgerId}/income/${incomeId}`);
          return { ledgerId, month, ...incomeFields(item), note: DELETED_INCOME_NOTE };
        },
        DELETE_INCOME_REFUSALS,
      ),
  );

  return server;
}

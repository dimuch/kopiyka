import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ApiError } from '../api.js';
import { eur, toCents, uah } from '../money.js';
import { monthSummary, sumCents, type ApiCategory } from './summary.js';

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

/** What one `/mcp` request may do: read as its user, and spend that user's tool calls. */
export interface RequestScope {
  read<T>(path: string): Promise<T>;
  /** Today in Kyiv, as 'YYYY-MM-DD'. */
  today(): string;
  /** Takes one tool call: 0 when allowed, otherwise the seconds until one is free. */
  takeToolCall(tool: string): number;
}

const errorResult = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true });

/** Runs a tool, handing a refusal or an API error to the LLM as a result it can read, not a protocol failure. */
async function toolResult(
  scope: RequestScope,
  tool: string,
  read: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  const waitSeconds = scope.takeToolCall(tool);
  if (waitSeconds > 0) {
    return errorResult(`rate_limited: too many requests from this connection; try again in ${waitSeconds} s`);
  }
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await read()) }] };
  } catch (err) {
    if (err instanceof ApiError) return errorResult(err.code);
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
          items: items.map(({ incomeId, title, amountEur, addedBy }) => ({
            incomeId,
            title,
            amount: eur(toCents(amountEur)),
            addedBy,
          })),
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

  return server;
}

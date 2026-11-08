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

const ALREADY_SAVED_NOTE =
  'An identical expense was saved in the last 10 minutes, so no second one was added. ' +
  'To add another on purpose, give it a name that tells them apart.';

const SAVED_NOTHING = 'This call saved nothing.';
const CHANGED_NOTHING = 'This call changed nothing.';
const DELETED_NOTHING = 'This call deleted nothing.';

/** Refusals every write tool shares: a read-only connection, and a ledger this user can't reach. */
const WRITE_ACCESS_REFUSALS = {
  insufficient_scope:
    'This connection can only read. Disconnect Kopiyka in Claude’s connectors, connect, and allow it.',
  ledger_not_found: 'No such ledger for this user; use list_ledgers.',
};

/** The API's refusals of an expense's fields, the same for adding and changing one. */
const EXPENSE_INPUT_REFUSALS = {
  category_not_in_month:
    'That category isn’t in that month’s list; use a categoryId from month_summary for that month.',
  unknown_category: 'That isn’t a category of this ledger.',
  invalid_request:
    'The amount must be positive with at most 8 digits and 2 decimals, the date a real YYYY-MM-DD from 2000 on, and the name at most 200 characters.',
  date_in_future: 'The date is too far ahead.',
  rate_unavailable: 'The NBU rate isn’t available; try later.',
};

/** Each sentence, followed by what the call didn't do. */
const ending = (sentences: Record<string, string>, didNothing: string) =>
  Object.fromEntries(Object.entries(sentences).map(([code, sentence]) => [code, `${sentence} ${didNothing}`]));

const lostAnswerFor = (sentence: string) => ({ api_unreachable: sentence, api_error: sentence, internal: sentence });

/** What the LLM can do about each API code. `date` is the one this call used, so a repeat can't land on another day. */
function addExpenseRefusals(date: string): Record<string, string> {
  return {
    ...ending(
      {
        ...WRITE_ACCESS_REFUSALS,
        ...EXPENSE_INPUT_REFUSALS,
      },
      SAVED_NOTHING,
    ),
    // A repeat just after the month's end comes here too, though the first call saved: the month check goes first.
    month_ended: `That month has ended and is read-only. ${SAVED_NOTHING} If an earlier call for this expense got no answer, it may have been saved: check with list_expenses.`,
    ...lostAnswerFor(
      'The answer was lost, so it may be saved. Repeat within 10 minutes with the same inputs and date set to ' +
        `${date}: it’s safe.`,
    ),
  };
}

const UPDATE_EXPENSE_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found: 'No live expense with that id in this ledger; find it with list_expenses.',
      month_ended: 'That month has ended and is read-only; an expense can’t move into or out of it either.',
      ...EXPENSE_INPUT_REFUSALS,
    },
    CHANGED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be saved. The same call repeated is safe.'),
};

const DELETE_EXPENSE_REFUSALS = {
  ...ending(
    {
      ...WRITE_ACCESS_REFUSALS,
      not_found:
        'No live expense with that id in this ledger. If an earlier call got no answer, it may already be deleted: ' +
        'check list_expenses.',
      month_ended: 'That month has ended and is read-only.',
    },
    DELETED_NOTHING,
  ),
  ...lostAnswerFor('The answer was lost, so it may be deleted. The same call repeated is safe.'),
};

const DELETED_EXPENSE_NOTE =
  'It can’t be brought back from Claude, and the app can’t restore it either. To undo, add it again with add_expense ' +
  'from this answer.';

/** What one `/mcp` request may do: read and write as its user, and spend that user's tool calls. */
export interface RequestScope {
  read<T>(path: string): Promise<T>;
  /** The API decides what this token may write. A DELETE sends no body. */
  write<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: object): Promise<T>;
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

  return server;
}

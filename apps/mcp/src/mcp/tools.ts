import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ApiError } from '../api.js';
import { eur, toCents } from '../money.js';
import { monthSummary, sumCents, type ApiCategory } from './summary.js';

interface ApiLedgers {
  user: { username: string };
  ledgers: { ledgerId: number; name: string; role: string; owner: string; label: string }[];
}

interface ApiExpense {
  categoryId: number;
  amountEur: string;
}

interface ApiIncomeItem {
  incomeId: number;
  title: string;
  amountEur: string;
  addedBy: string;
}

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

  return server;
}

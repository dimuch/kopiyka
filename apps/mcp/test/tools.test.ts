import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { sealAccessToken } from '../src/mcp/auth.js';
import { bearerOf, fakeApi, type Answer, type RecordedCall } from './fakeApi.js';
import { rpcResult, toolData } from './rpc.js';

const PUBLIC_URL = 'https://kopiyka.example';
const HOST = 'kopiyka.example';

const config: Config = {
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  publicUrl: PUBLIC_URL,
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
};

/** Ledger 1 belongs to olena's token; anything else is the API's `ledger_not_found`. */
function ledgerOne(call: RecordedCall): Answer {
  if (call.path === '/api/api-tokens') return { json: { tokens: [] } };
  if (bearerOf(call) !== 'kpk.olena' || !call.path.startsWith('/api/ledgers/1/')) {
    return { status: 404, json: { error: 'ledger_not_found' } };
  }
  if (call.path === '/api/ledgers/1/categories?month=2026-10') {
    return { json: { categories: [{ categoryId: 7, displayName: 'Food', plannedEur: '100.00' }] } };
  }
  if (call.path === '/api/ledgers/1/expenses?month=2026-10') {
    return { json: { expenses: [{ categoryId: 7, amountEur: '30.50' }] } };
  }
  if (call.path === '/api/ledgers/1/months/2026-10/income') {
    return {
      json: {
        items: [
          { incomeId: 3, title: 'Salary', amountEur: '1000.00', addedBy: 'olena' },
          { incomeId: 4, title: 'Bonus', amountEur: '250.50', addedBy: 'taras' },
        ],
      },
    };
  }
  return { status: 404, json: { error: 'not_found' } };
}

describe('the budget tools', () => {
  let app: FastifyInstance;
  let answer: (call: RecordedCall) => Answer;
  let api: ReturnType<typeof fakeApi>;
  let clock: Date;

  const callTool = (name: string, args: object, apiToken = 'kpk.olena') =>
    app
      .inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          host: HOST,
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: `Bearer ${sealAccessToken(
            config.sealKey,
            { aud: `${PUBLIC_URL}/mcp`, apiToken, clientId: 'claude' },
            Date.now() + 3_600_000,
          )}`,
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
      })
      .then(rpcResult);

  beforeEach(async () => {
    answer = ledgerOne;
    clock = new Date();
    api = fakeApi((call) => answer(call));
    app = await buildApp({ config, now: () => clock, fetch: api.fetch, limits: { toolCallBurst: 100 } });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('month_summary', () => {
    it('sums the month from the API’s three lists', async () => {
      const result = await callTool('month_summary', { ledgerId: 1, month: '2026-10' });

      expect(result.isError).toBeUndefined();
      expect(toolData(result)).toEqual({
        ledgerId: 1,
        month: '2026-10',
        currency: 'EUR',
        categories: [
          {
            categoryId: 7,
            name: 'Food',
            planned: { amount: '100.00', formatted: '€100.00' },
            spent: { amount: '30.50', formatted: '€30.50' },
            left: { amount: '69.50', formatted: '€69.50' },
            expenseCount: 1,
          },
        ],
        totals: {
          planned: { amount: '100.00', formatted: '€100.00' },
          spent: { amount: '30.50', formatted: '€30.50' },
          left: { amount: '69.50', formatted: '€69.50' },
        },
        income: {
          total: { amount: '1250.50', formatted: '€1,250.50' },
          leftToPlan: { amount: '1150.50', formatted: '€1,150.50' },
        },
      });
    });

    it('answers ledger_not_found for someone else’s ledger', async () => {
      const result = await callTool('month_summary', { ledgerId: 1, month: '2026-10' }, 'kpk.taras');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('ledger_not_found');
    });

    it.each([
      ['a month that doesn’t exist', { ledgerId: 1, month: '2026-13' }],
      ['a path in the month', { ledgerId: 1, month: '2026-10/../../x' }],
      ['a ledger id that isn’t a positive whole number', { ledgerId: -1, month: '2026-10' }],
    ])('refuses %s without asking the API for data', async (_case, args) => {
      const result = await callTool('month_summary', args);

      expect(result.isError).toBe(true);
      expect(api.calls.map((call) => call.path)).toEqual(['/api/api-tokens']);
    });
  });

  describe('list_income', () => {
    it('lists the month with its total', async () => {
      const result = await callTool('list_income', { ledgerId: 1, month: '2026-10' });

      expect(toolData(result)).toEqual({
        ledgerId: 1,
        month: '2026-10',
        total: { amount: '1250.50', formatted: '€1,250.50' },
        items: [
          { incomeId: 3, title: 'Salary', amount: { amount: '1000.00', formatted: '€1,000.00' }, addedBy: 'olena' },
          { incomeId: 4, title: 'Bonus', amount: { amount: '250.50', formatted: '€250.50' }, addedBy: 'taras' },
        ],
      });
    });

    it('answers ledger_not_found for someone else’s ledger', async () => {
      const result = await callTool('list_income', { ledgerId: 2, month: '2026-10' });

      expect(result.content[0].text).toBe('ledger_not_found');
    });
  });

  describe('list_expenses', () => {
    const expense = (expenseId: number) => ({
      expenseId,
      categoryId: 7,
      expenseDate: '2026-10-05',
      name: `Item ${expenseId}`,
      amountEur: '12.50',
      amountUah: '631.04',
      eurUahRate: '50.4830',
      enteredCurrency: 'EUR',
      createdBy: 1,
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: '2026-10-05T10:00:00.000Z',
    });
    const sixty = Array.from({ length: 60 }, (_item, index) => expense(index + 1));

    beforeEach(() => {
      answer = (call) =>
        call.path.startsWith('/api/ledgers/1/expenses') ? { json: { expenses: sixty } } : ledgerOne(call);
    });

    const ids = (data: { expenses: { expenseId: number }[] }) => data.expenses.map(({ expenseId }) => expenseId);

    it('gives the first page and says where the next starts', async () => {
      const data = toolData(await callTool('list_expenses', { ledgerId: 1, month: '2026-10' }));

      expect(data).toMatchObject({ ledgerId: 1, month: '2026-10', total: 60, offset: 0, limit: 25, nextOffset: 25 });
      expect(ids(data)).toEqual(sixty.slice(0, 25).map(({ expenseId }) => expenseId));
    });

    it('says there’s no next page at the end', async () => {
      const data = toolData(await callTool('list_expenses', { ledgerId: 1, month: '2026-10', offset: 50 }));

      expect(data).toMatchObject({ offset: 50, nextOffset: null });
      expect(ids(data)).toEqual(sixty.slice(50).map(({ expenseId }) => expenseId));
    });

    it('gives an empty page past the end', async () => {
      const data = toolData(await callTool('list_expenses', { ledgerId: 1, month: '2026-10', offset: 60 }));

      expect(data).toMatchObject({ total: 60, nextOffset: null, expenses: [] });
    });

    it('shapes each expense, with its category’s name', async () => {
      const data = toolData(await callTool('list_expenses', { ledgerId: 1, month: '2026-10', limit: 1 }));

      expect(data.expenses).toEqual([
        {
          expenseId: 1,
          date: '2026-10-05',
          name: 'Item 1',
          categoryId: 7,
          categoryName: 'Food',
          amountEur: { amount: '12.50', formatted: '€12.50' },
          amountUah: { amount: '631.04', formatted: '₴631.04' },
          enteredCurrency: 'EUR',
          eurUahRate: '50.4830',
        },
      ]);
    });

    it.each([{ limit: 51 }, { limit: 0 }, { offset: -1 }])('refuses %j', async (args) => {
      const result = await callTool('list_expenses', { ledgerId: 1, month: '2026-10', ...args });

      expect(result.isError).toBe(true);
    });

    it('passes a category on to the API', async () => {
      await callTool('list_expenses', { ledgerId: 1, month: '2026-10', categoryId: 7 });

      expect(api.calls.map((call) => call.path)).toContain('/api/ledgers/1/expenses?month=2026-10&categoryId=7');
    });

    it('answers ledger_not_found for someone else’s ledger', async () => {
      const result = await callTool('list_expenses', { ledgerId: 2, month: '2026-10' });

      expect(result.content[0].text).toBe('ledger_not_found');
    });
  });

  describe('eur_uah_rate', () => {
    beforeEach(() => {
      answer = (call) =>
        call.path.startsWith('/api/rates/')
          ? { json: { date: '2026-11-03', rateDate: '2026-11-02', eurUah: 50.483 } }
          : ledgerOne(call);
    });

    it('asks for today in Kyiv and spells the rate out', async () => {
      clock = new Date('2026-11-02T22:30:00Z');
      // The bearer check compares its expiry with the real clock, so only the tool's date is moved.
      const data = toolData(await callTool('eur_uah_rate', {}));

      expect(api.calls.map((call) => call.path)).toContain('/api/rates/eur-uah?date=2026-11-03');
      expect(data).toEqual({
        date: '2026-11-03',
        rateDate: '2026-11-02',
        eurUah: 50.483,
        formatted: '1 EUR = 50.4830 UAH',
      });
    });

    it('reports a rate the API can’t get', async () => {
      answer = (call) =>
        call.path.startsWith('/api/rates/')
          ? { status: 503, json: { error: 'rate_unavailable', reason: 'nbu_unreachable' } }
          : ledgerOne(call);

      const result = await callTool('eur_uah_rate', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('rate_unavailable');
    });
  });
});

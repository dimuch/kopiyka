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
    api = fakeApi((call) => answer(call));
    app = await buildApp({ config, now: () => new Date(), fetch: api.fetch });
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
});

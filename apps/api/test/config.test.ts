import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const base = { DATABASE_URL: 'mysql://u:p@127.0.0.1/db', TOTP_ENC_KEY: randomBytes(32).toString('base64') };

  it.each([
    ['production', undefined, true],
    ['production', 'false', false],
    ['development', undefined, false],
    ['development', 'true', true],
  ] as const)('NODE_ENV=%s, COOKIE_SECURE=%s → cookieSecure %s', (nodeEnv, cookieSecure, expected) => {
    const source = { ...base, NODE_ENV: nodeEnv, ...(cookieSecure ? { COOKIE_SECURE: cookieSecure } : {}) };
    expect(loadConfig(source).cookieSecure).toBe(expected);
  });

  it('reads the Notion sync scope only when both variables are set', () => {
    expect(loadConfig(base).notion).toBeNull();
    expect(loadConfig({ ...base, NOTION_LEDGER_ID: '1', NOTION_YEAR: '2026' }).notion).toEqual({
      ledgerId: 1,
      year: 2026,
    });
    expect(() => loadConfig({ ...base, NOTION_LEDGER_ID: '1' })).toThrow(/together/);
    expect(() => loadConfig({ ...base, NOTION_YEAR: '2026' })).toThrow(/together/);
    expect(() => loadConfig({ ...base, NOTION_LEDGER_ID: '1', NOTION_YEAR: '20x6' })).toThrow();
  });

  it('reads the Notion API settings in two pairs, the second needing the first', () => {
    const ds = '00000000-0000-4000-8000-000000000001';
    const expenses = '00000000-0000-4000-8000-000000000002';
    const netto = '00000000-0000-4000-8000-000000000003';
    const groceries = { NOTION_TOKEN: 'ntn_x', NOTION_GROCERIES_DATA_SOURCE_ID: ds };
    expect(loadConfig(base).notionApi).toBeNull();
    expect(loadConfig({ ...base, ...groceries }).notionApi).toEqual({
      token: 'ntn_x',
      groceriesDataSourceId: ds,
      totals: null,
      balances: null,
    });
    expect(
      loadConfig({
        ...base,
        ...groceries,
        NOTION_EXPENSES_DATA_SOURCE_ID: expenses,
        NOTION_NETTO_DATA_SOURCE_ID: netto,
      }).notionApi,
    ).toEqual({
      token: 'ntn_x',
      groceriesDataSourceId: ds,
      totals: { expensesDataSourceId: expenses, nettoDataSourceId: netto },
      balances: null,
    });
    expect(() => loadConfig({ ...base, NOTION_TOKEN: 'ntn_x' })).toThrow(/together/);
    expect(() => loadConfig({ ...base, NOTION_GROCERIES_DATA_SOURCE_ID: ds })).toThrow(/together/);
    expect(() => loadConfig({ ...base, ...groceries, NOTION_EXPENSES_DATA_SOURCE_ID: expenses })).toThrow(/together/);
    expect(() =>
      loadConfig({ ...base, NOTION_EXPENSES_DATA_SOURCE_ID: expenses, NOTION_NETTO_DATA_SOURCE_ID: netto }),
    ).toThrow(/together/);
    expect(() =>
      loadConfig({ ...base, NOTION_TOKEN: 'ntn_x', NOTION_GROCERIES_DATA_SOURCE_ID: `collection://${ds}` }),
    ).toThrow();
  });

  it('reads the Opening and Actual Closing data sources as a pair that needs the token (brief 085)', () => {
    const groceries = {
      NOTION_TOKEN: 'ntn_x',
      NOTION_GROCERIES_DATA_SOURCE_ID: '00000000-0000-4000-8000-000000000001',
    };
    const opening = '00000000-0000-4000-8000-000000000004';
    const closing = '00000000-0000-4000-8000-000000000005';
    const pair = { NOTION_OPENING_DATA_SOURCE_ID: opening, NOTION_CLOSING_DATA_SOURCE_ID: closing };
    expect(loadConfig({ ...base, ...groceries, ...pair }).notionApi?.balances).toEqual({
      openingDataSourceId: opening,
      closingDataSourceId: closing,
    });
    expect(loadConfig({ ...base, ...groceries }).notionApi?.balances).toBeNull();
    expect(() => loadConfig({ ...base, ...groceries, NOTION_OPENING_DATA_SOURCE_ID: opening })).toThrow(/together/);
    expect(() => loadConfig({ ...base, ...groceries, NOTION_CLOSING_DATA_SOURCE_ID: closing })).toThrow(/together/);
    expect(() => loadConfig({ ...base, ...pair })).toThrow(/NOTION_TOKEN/);
  });
});

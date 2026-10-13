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

  it('reads the Notion API settings only when both are set', () => {
    const ds = '2d2203e3-e5e5-819d-8823-000be6f1bad0';
    expect(loadConfig(base).notionApi).toBeNull();
    expect(loadConfig({ ...base, NOTION_TOKEN: 'ntn_x', NOTION_GROCERIES_DATA_SOURCE_ID: ds }).notionApi).toEqual({
      token: 'ntn_x',
      groceriesDataSourceId: ds,
    });
    expect(() => loadConfig({ ...base, NOTION_TOKEN: 'ntn_x' })).toThrow(/together/);
    expect(() => loadConfig({ ...base, NOTION_GROCERIES_DATA_SOURCE_ID: ds })).toThrow(/together/);
    expect(() =>
      loadConfig({ ...base, NOTION_TOKEN: 'ntn_x', NOTION_GROCERIES_DATA_SOURCE_ID: `collection://${ds}` }),
    ).toThrow();
  });
});

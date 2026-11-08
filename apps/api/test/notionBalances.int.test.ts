import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { type BalancesSnapshot, wantedBalances } from '../src/notion/balances.js';
import { importBalances, previewBalances } from '../src/notion/balancesImport.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('month balances import (MySQL)', () => {
  const config = testConfig();
  let db: Db;
  let owner: TestUser;

  /** Jan 0/−180; Feb opening −180 with two closings; Aug opening 0; Sept opening −377. */
  const base: BalancesSnapshot = {
    opening: [
      { month: 1, amount: '0.00' },
      { month: 2, amount: '-180.00' },
      { month: 8, amount: '0.00' },
      { month: 9, amount: '-377.00' },
    ],
    closing: [
      { month: 1, amount: '-180.00' },
      { month: 2, amount: '-50.25' },
      { month: 2, amount: '-1.75' },
    ],
  };
  const baseRows = [
    ['2026-01-01', '0.00', '-180.00'],
    ['2026-02-01', '-180.00', '-52.00'],
    ['2026-03-01', '-52.00', '0.00'],
    ['2026-04-01', '0.00', '0.00'],
    ['2026-05-01', '0.00', '0.00'],
    ['2026-06-01', '0.00', '0.00'],
    ['2026-07-01', '0.00', '0.00'],
    ['2026-08-01', '0.00', '-377.00'],
    ['2026-09-01', '-377.00', '0.00'],
    ['2026-10-01', '0.00', '0.00'],
  ];

  /** The ledger's stored balances in key order, as [month, opening, closing]. */
  async function rows(ledgerId = owner.ledgerId) {
    const [result] = await db.query<RowDataPacket[]>(
      'SELECT balance_month, opening_eur, closing_eur FROM month_balances WHERE ledger_id = ? ORDER BY balance_month',
      [ledgerId],
    );
    return result.map((r) => [String(r.balance_month), r.opening_eur, r.closing_eur]);
  }

  async function seed(ledgerId: number, month: string, opening: string, closing: string) {
    await db.query(
      'INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, ?, ?, ?)',
      [ledgerId, month, opening, closing],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });
  afterAll(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'balances-owner');
  });

  it('stores each month’s sum and fills the missing sides', async () => {
    const changes = await importBalances(db, owner.ledgerId, wantedBalances(base));
    expect(changes.every((c) => c.changed && c.from === null)).toBe(true);
    expect(await rows()).toEqual(baseRows);
  });

  it('a second run changes nothing; a changed or removed row refills its months', async () => {
    await importBalances(db, owner.ledgerId, wantedBalances(base));
    expect((await importBalances(db, owner.ledgerId, wantedBalances(base))).some((c) => c.changed)).toBe(false);
    expect(await rows()).toEqual(baseRows);

    // The −1.75 February closing and September's opening are gone from Notion. These months have ended: the import has
    // no clock or month lock.
    const changed: BalancesSnapshot = {
      opening: base.opening.filter((r) => r.month !== 9),
      closing: base.closing.filter((r) => r.amount !== '-1.75'),
    };
    const expected = baseRows.map((row) => {
      const refilled: Record<string, string[]> = {
        '2026-02-01': ['2026-02-01', '-180.00', '-50.25'],
        '2026-03-01': ['2026-03-01', '-50.25', '0.00'],
        '2026-08-01': ['2026-08-01', '0.00', '0.00'],
        '2026-09-01': ['2026-09-01', '0.00', '0.00'],
      };
      return refilled[row[0]!] ?? row;
    });
    const result = await importBalances(db, owner.ledgerId, wantedBalances(changed));
    expect(result.filter((c) => c.changed).map((c) => c.month)).toEqual(['2026-02', '2026-03', '2026-08', '2026-09']);
    expect(await rows()).toEqual(expected);

    // A run stopped halfway leaves stale rows; the next run ends in the same state.
    await clearData(db);
    owner = await makeUser(db, config, 'balances-owner');
    await seed(owner.ledgerId, '2026-02-01', '1.00', '2.00');
    await importBalances(db, owner.ledgerId, wantedBalances(changed));
    expect(await rows()).toEqual(expected);
  });

  it('ignores November and December, a stored November and other ledgers', async () => {
    const other = await makeUser(db, config, 'balances-other');
    await seed(owner.ledgerId, '2026-11-01', '-35.00', '-690.00');
    await seed(other.ledgerId, '2026-01-01', '5.00', '6.00');
    const withLateMonths: BalancesSnapshot = {
      opening: [...base.opening, { month: 11, amount: '-1.00' }, { month: 12, amount: '-2.00' }],
      closing: [...base.closing, { month: 11, amount: '-3.00' }],
    };
    await importBalances(db, owner.ledgerId, wantedBalances(withLateMonths));
    expect(await rows()).toEqual([...baseRows, ['2026-11-01', '-35.00', '-690.00']]);
    expect(await rows(other.ledgerId)).toEqual([['2026-01-01', '5.00', '6.00']]);
  });

  it('writes only the months it’s given', async () => {
    await seed(owner.ledgerId, '2026-02-01', '1.00', '2.00');
    await seed(owner.ledgerId, '2026-11-01', '-35.00', '-690.00');
    const changes = await importBalances(
      db,
      owner.ledgerId,
      wantedBalances(base).filter((m) => m.month === '2026-01'),
    );
    expect(changes.map((c) => [c.month, c.changed])).toEqual([['2026-01', true]]);
    expect(await rows()).toEqual([
      ['2026-01-01', '0.00', '-180.00'],
      ['2026-02-01', '1.00', '2.00'],
      ['2026-11-01', '-35.00', '-690.00'],
    ]);
  });

  it('a dry run reports the changes and writes nothing', async () => {
    await seed(owner.ledgerId, '2026-02-01', '1.00', '2.00');
    const before = await rows();
    const changes = await previewBalances(db, owner.ledgerId, wantedBalances(base));
    expect(changes[0]).toMatchObject({ month: '2026-01', from: null, changed: true });
    expect(changes[1]).toMatchObject({
      month: '2026-02',
      from: { openingCents: 100n, closingCents: 200n },
      changed: true,
    });
    expect(changes.every((c) => c.changed)).toBe(true);
    expect(await rows()).toEqual(before);
    expect(before).toEqual([['2026-02-01', '1.00', '2.00']]);
  });

  it('an unknown ledger throws', async () => {
    await expect(previewBalances(db, 999999, wantedBalances(base))).rejects.toThrow('No ledger 999999');
    await expect(importBalances(db, 999999, wantedBalances(base))).rejects.toThrow('No ledger 999999');
  });
});

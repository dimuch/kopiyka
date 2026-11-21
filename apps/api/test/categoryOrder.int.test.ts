import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { DEFAULT_CATEGORIES } from '../src/defaultCategories.js';
import { addMember } from '../src/ledgers/members.js';
import {
  authHeader,
  clearData,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('categories in my own order (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  const seeded = DEFAULT_CATEGORIES.map((category) => category.techName);
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let auth: { authorization: string };
  let memberAuth: { authorization: string };

  const listFor = async (headers: Record<string, string>, month = '2026-10') => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/ledgers/${owner.ledgerId}/categories?month=${month}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { categories: { techName: string }[]; quickCategoryIds: number[] };
    return { names: body.categories.map((category) => category.techName), quick: body.quickCategoryIds };
  };

  const idOf = async (techName: string) => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
      [owner.ledgerId, techName],
    );
    return rows[0]!.category_id as number;
  };

  /** Writes a member's order rows directly: `techNames[i]` gets position i. */
  const placeFor = async (user: TestUser, techNames: string[]) => {
    for (const [position, techName] of techNames.entries()) {
      await db.query(
        'INSERT INTO category_orders (ledger_id, user_id, category_id, list_position) VALUES (?, ?, ?, ?)',
        [owner.ledgerId, user.userId, await idOf(techName), position],
      );
    }
  };

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'ivanka');
    member = await makeUser(db, config, 'dmytro');
    await addMember(db, owner.ledgerId, member.userId);
    auth = await authHeader(app, owner, clock);
    memberAuth = await authHeader(app, member, clock);
  });

  it('lists each member’s placed categories first, then the rest in ledger order', async () => {
    await placeFor(owner, ['gym', 'rent']);
    await placeFor(member, ['car']);
    const third = await makeUser(db, config, 'sviat');
    await addMember(db, owner.ledgerId, third.userId);

    const mine = await listFor(auth);
    const theirs = await listFor(memberAuth);
    const untouched = await listFor(await authHeader(app, third, clock));

    expect(mine.names).toEqual(['gym', 'rent', ...seeded.filter((name) => name !== 'gym' && name !== 'rent')]);
    expect(theirs.names).toEqual(['car', ...seeded.filter((name) => name !== 'car')]);
    expect(untouched.names).toEqual(seeded);
    expect(theirs.quick).toEqual(mine.quick);
    expect(untouched.quick).toEqual(mine.quick);
  });

  it('uses the same order in every month', async () => {
    await placeFor(owner, ['gym', 'rent']);

    expect((await listFor(auth, '2026-09')).names.slice(0, 3)).toEqual(['gym', 'rent', 'groceries']);
  });
});

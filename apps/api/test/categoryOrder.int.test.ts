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
  storeMonthList,
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

  describe('PUT …/categories/order', () => {
    const save = (
      payload: Record<string, unknown> | undefined,
      headers: Record<string, string> = auth,
      ledgerId = owner.ledgerId,
    ) => app.inject({ method: 'PUT', url: `/api/ledgers/${ledgerId}/categories/order`, payload, headers });

    const idsOf = (techNames: string[]) => Promise.all(techNames.map(idOf));
    const gymFirst = ['gym', ...seeded.filter((name) => name !== 'gym')];

    it('saves my order for every month', async () => {
      const res = await save({ categoryIds: await idsOf(gymFirst) });

      expect(res.statusCode).toBe(204);
      expect((await listFor(auth)).names).toEqual(gymFirst);
      expect((await listFor(auth, '2026-09')).names).toEqual(gymFirst);
    });

    it('keeps a category the month lacks where it was in other months', async () => {
      await storeMonthList(db, owner.ledgerId, '2026-10', ['fun']);
      const october = gymFirst.filter((name) => name !== 'fun');

      expect((await save({ categoryIds: await idsOf(october) })).statusCode).toBe(204);
      expect((await listFor(auth)).names).toEqual(october);
      expect((await listFor(auth, '2026-09')).names).toEqual(gymFirst);
    });

    it('lists a category added after the save last', async () => {
      await save({ categoryIds: await idsOf(gymFirst) });
      const added = await app.inject({
        method: 'POST',
        url: `/api/ledgers/${owner.ledgerId}/months/2026-10/categories`,
        payload: { name: 'pets' },
        headers: auth,
      });

      expect(added.statusCode).toBe(201);
      expect((await listFor(auth)).names).toEqual([...gymFirst, 'pets']);
    });

    it('never changes another member’s order', async () => {
      await save({ categoryIds: await idsOf(gymFirst) });
      expect((await listFor(memberAuth)).names).toEqual(seeded);

      const carFirst = ['car', ...seeded.filter((name) => name !== 'car')];
      expect((await save({ categoryIds: await idsOf(carFirst) }, memberAuth)).statusCode).toBe(204);
      expect((await listFor(memberAuth)).names).toEqual(carFirst);
      expect((await listFor(auth)).names).toEqual(gymFirst);
    });

    it('refuses an id that isn’t a live category of the ledger, writing nothing', async () => {
      await save({ categoryIds: await idsOf(gymFirst) });
      const [foreign] = await db.query<RowDataPacket[]>('SELECT category_id FROM categories WHERE ledger_id = ?', [
        member.ledgerId,
      ]);
      const deleted = await idOf('sviat');
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, deleted]);
      const live = (await idsOf(gymFirst)).filter((id) => id !== deleted);

      for (const stray of [999_999, foreign[0]!.category_id as number, deleted]) {
        const res = await save({ categoryIds: [stray, ...live] });
        expect([res.statusCode, res.json()]).toEqual([400, { error: 'unknown_category' }]);
      }
      expect((await listFor(auth)).names).toEqual(gymFirst.filter((name) => name !== 'sviat'));
    });

    it('refuses a body that isn’t a list of distinct ids', async () => {
      const [rent] = await idsOf(['rent']);

      for (const payload of [{ categoryIds: [rent, rent] }, { categoryIds: [] }, undefined, { categoryIds: [0] }]) {
        const res = await save(payload);
        expect([res.statusCode, res.json().error]).toEqual([400, 'invalid_request']);
      }
    });

    it('needs a session and a ledger I belong to', async () => {
      const ids = await idsOf(gymFirst);
      const stranger = await makeUser(db, config, 'stranger');

      expect((await save({ categoryIds: ids }, {})).statusCode).toBe(401);
      expect((await save({ categoryIds: ids }, await authHeader(app, stranger, clock))).statusCode).toBe(404);
      expect((await listFor(auth)).names).toEqual(seeded);
    });
  });
});

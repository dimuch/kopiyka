import { describe, expect, it } from 'vitest';
import { NotionError, notionClient } from '../src/notion/client.js';

const token = 'ntn_secret_test_token';
const ds = '2d2203e3-e5e5-819d-8823-000be6f1bad0';
const expensesDs = '2d2203e3-e5e5-8154-8e58-000b356e2d71';
const nettoDs = '2d2203e3-e5e5-8153-8e48-000b2762daa5';
const row = { expenseId: 57, name: 'Delhaize', amountEur: '29.10', date: '2026-10-01' };

/** A client whose fetch answers from a queue and records every request and every sleep. */
function setup(...answers: Array<Response | Error>) {
  const requests: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
  const sleeps: number[] = [];
  const notion = notionClient(
    { token, groceriesDataSourceId: ds, totals: { expensesDataSourceId: expensesDs, nettoDataSourceId: nettoDs } },
    {
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          method: init?.method ?? 'GET',
          headers: init?.headers as Record<string, string>,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        const next = answers.shift();
        if (!next || next instanceof Error) throw next ?? new Error('no answer queued');
        return next;
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => 1_000_000,
    },
  );
  return { client: notion.groceries, expenses: notion.expenses!, requests, sleeps };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('notionClient', () => {
  it('creates a row in the Groceries data source', async () => {
    const { client, requests } = setup(json({ id: '2D2203E3-E5E5-81E9-9C53-C4FF0D748207' }));
    expect(await client.create(row)).toBe('2d2203e3e5e581e99c53c4ff0d748207');
    expect(requests).toEqual([
      {
        url: 'https://api.notion.com/v1/pages',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
        body: {
          parent: { type: 'data_source_id', data_source_id: ds },
          properties: {
            Name: { title: [{ text: { content: 'Delhaize' } }] },
            Amount: { number: 29.1 },
            Date: { date: { start: '2026-10-01' } },
            Month: { select: { name: 'October' } },
            'Kopiyka ID': { number: 57 },
          },
        },
      },
    ]);
  });

  it('names the month from the date', async () => {
    const { client, requests } = setup(json({}), json({}));
    await client.update('p1', { ...row, date: '2026-01-31' });
    await client.update('p1', { ...row, date: '2026-12-31' });
    expect(
      requests.map((r) => [
        r.url,
        r.method,
        (r.body as { properties: { Month: { select: { name: string } } } }).properties.Month.select.name,
      ]),
    ).toEqual([
      ['https://api.notion.com/v1/pages/p1', 'PATCH', 'January'],
      ['https://api.notion.com/v1/pages/p1', 'PATCH', 'December'],
    ]);
  });

  it('finds the live row with a Kopiyka ID', async () => {
    const trashed = { id: 'aaaa', in_trash: true };
    const live = { id: '2D2203E3-E5E5-8173-A301-F4C19BC4FF8D', in_trash: false };
    const { client, requests } = setup(
      json({ results: [] }),
      json({ results: [trashed] }),
      json({ results: [trashed, live] }),
    );
    expect(await client.find(57)).toBeNull();
    expect(await client.find(57)).toBeNull();
    expect(await client.find(57)).toBe('2d2203e3e5e58173a301f4c19bc4ff8d');
    expect(requests[0]).toMatchObject({
      url: `https://api.notion.com/v1/data_sources/${ds}/query`,
      method: 'POST',
      body: { filter: { property: 'Kopiyka ID', number: { equals: 57 } }, page_size: 10 },
    });
  });

  it('moves a row in and out of trash', async () => {
    const { client, requests } = setup(json({}));
    await client.setInTrash('p1', false);
    expect(requests[0]).toMatchObject({
      url: 'https://api.notion.com/v1/pages/p1',
      method: 'PATCH',
      body: { in_trash: false },
    });
  });

  it('tells whether a page is in trash', async () => {
    const { client, requests } = setup(json({ id: 'p', in_trash: true }), json({ id: 'p', in_trash: false }));
    expect(await client.isInTrash('p1')).toBe(true);
    expect(await client.isInTrash('p1')).toBe(false);
    expect(requests[0]).toMatchObject({ url: 'https://api.notion.com/v1/pages/p1', method: 'GET', body: undefined });
  });

  it('keeps requests at least 334 ms apart', async () => {
    const { client, sleeps } = setup(json({}), json({}));
    await client.setInTrash('p1', true);
    await client.setInTrash('p1', true);
    expect(sleeps).toEqual([334]);
  });

  it('waits out Retry-After and gives up after 3 attempts', async () => {
    const limited = () => json({ object: 'error', status: 429, code: 'rate_limited' }, 429, { 'Retry-After': '2' });
    const ok = setup(limited(), json({}));
    await ok.client.setInTrash('p1', true);
    expect(ok.sleeps).toEqual([2000, 334]);

    const overloaded = setup(json({ code: 'service_overload' }, 529), json({}));
    await overloaded.client.setInTrash('p1', true);
    expect(overloaded.sleeps).toEqual([1000, 334]); // no Retry-After: wait a second

    const busy = setup(limited(), limited(), limited());
    await expect(busy.client.setInTrash('p1', true)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('turns failures into NotionError without leaking the token', async () => {
    const notFound = setup(
      json({ object: 'error', status: 404, code: 'object_not_found', message: 'Could not find page' }, 404),
    );
    const err = await notFound.client.update('p1', row).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotionError);
    expect(err).toMatchObject({ status: 404, code: 'object_not_found' });

    const noId = setup(json({ object: 'page' }));
    await expect(noId.client.create(row)).rejects.toMatchObject({ status: 200, code: 'bad_response' });

    const proxy = setup(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(proxy.client.update('p1', row)).rejects.toMatchObject({ status: 502, code: 'notion_error' });

    const offline = setup(new TypeError('fetch failed'));
    const down = await offline.client.find(57).catch((e: unknown) => e);
    expect(down).toMatchObject({ status: 0, code: 'notion_unreachable' });
    for (const e of [err, down]) expect(String((e as Error).message)).not.toContain(token);
  });

  describe('Expenses table', () => {
    const OCTOBER = '2d2203e3e5e581c8ab4bf9cd93251846';
    const expensesRow = (id: string, category: string, inTrash = false) => ({
      id,
      in_trash: inTrash,
      properties: { Category: { title: [{ plain_text: category }] } },
    });

    it("lists a month's rows: those linked to the month's Netto page", async () => {
      const { expenses, requests } = setup(
        json({ results: [{ id: '2d2203e3-e5e5-81c8-ab4b-f9cd93251846', in_trash: false }] }),
        json({
          results: [
            expensesRow('2D2203E3-E5E5-811E-AF85-E0821E42C511', 'clothes'),
            expensesRow('2d2203e3e5e581deb784c6fa0f836c28', 'fun', true),
          ],
        }),
      );
      expect(await expenses.monthRows('2026-10')).toEqual({
        nettoPageId: OCTOBER,
        rows: [{ pageId: '2d2203e3e5e5811eaf85e0821e42c511', category: 'clothes' }],
      });
      expect(requests.map((r) => [r.url, r.method, r.body])).toEqual([
        [
          `https://api.notion.com/v1/data_sources/${nettoDs}/query`,
          'POST',
          { filter: { property: 'Month', title: { equals: 'October' } }, page_size: 10 },
        ],
        [
          `https://api.notion.com/v1/data_sources/${expensesDs}/query`,
          'POST',
          {
            filter: {
              and: [
                { property: 'Month', select: { equals: 'Oct' } },
                {
                  or: [
                    { property: 'B to Netto', relation: { contains: OCTOBER } },
                    { property: 'E to Netto', relation: { contains: OCTOBER } },
                  ],
                },
              ],
            },
            page_size: 100,
          },
        ],
      ]);
    });

    it("uses Notion's month names, and answers null without a Netto page", async () => {
      const sept = setup(json({ results: [{ id: OCTOBER }] }), json({ results: [] }));
      await sept.expenses.monthRows('2026-09');
      expect((sept.requests[0]!.body as { filter: { title: { equals: string } } }).filter.title.equals).toBe(
        'September',
      );
      expect(JSON.stringify(sept.requests[1]!.body)).toContain('"equals":"Sept"');

      const missing = setup(json({ results: [] }));
      expect(await missing.expenses.monthRows('2026-11')).toBeNull();
      expect(missing.requests.length).toBe(1);
    });

    it('reads and writes Actual Amount in cents', async () => {
      const { expenses, requests } = setup(
        json({ properties: { 'Actual Amount': { number: 653 } } }),
        json({ properties: { 'Actual Amount': { number: 23.5 } } }),
        json({ properties: { 'Actual Amount': { number: null } } }),
        json({}),
        json({}),
      );
      expect(await expenses.actualCents('p1')).toBe(65300n);
      expect(await expenses.actualCents('p1')).toBe(2350n);
      expect(await expenses.actualCents('p1')).toBeNull();
      await expenses.setActualCents('p1', 8400n);
      await expenses.setActualCents('p1', 2350n);
      expect(requests.map((r) => [r.url, r.method, r.body])).toEqual([
        ['https://api.notion.com/v1/pages/p1', 'GET', undefined],
        ['https://api.notion.com/v1/pages/p1', 'GET', undefined],
        ['https://api.notion.com/v1/pages/p1', 'GET', undefined],
        ['https://api.notion.com/v1/pages/p1', 'PATCH', { properties: { 'Actual Amount': { number: 84 } } }],
        ['https://api.notion.com/v1/pages/p1', 'PATCH', { properties: { 'Actual Amount': { number: 23.5 } } }],
      ]);
    });

    it('is absent without the Expenses settings', () => {
      expect(notionClient({ token, groceriesDataSourceId: ds, totals: null }).expenses).toBeNull();
    });
  });
});

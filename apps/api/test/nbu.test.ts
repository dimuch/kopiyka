import { describe, expect, it, vi } from 'vitest';
import { nbuFetcher } from '../src/rates/nbu.js';

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('nbuFetcher', () => {
  it('asks for EUR on the compact date and returns the rate', async () => {
    const fetchImpl = fakeFetch([{ r030: 978, txt: 'Євро', rate: 50.483, cc: 'EUR', exchangedate: '06.10.2026' }]);
    expect(await nbuFetcher(fetchImpl)('2026-10-06')).toBe(50.483);
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&date=20261006&json',
    );
  });

  it('returns null for a date the NBU has not published', async () => {
    expect(await nbuFetcher(fakeFetch([]))('2026-10-10')).toBeNull();
  });

  it('returns null when the answer is for another day', async () => {
    const fetchImpl = fakeFetch([{ rate: 50.1, cc: 'EUR', exchangedate: '05.10.2026' }]);
    expect(await nbuFetcher(fetchImpl)('2026-10-06')).toBeNull();
  });

  it('throws on an HTTP error so a bad answer is never cached', async () => {
    await expect(nbuFetcher(fakeFetch({}, 503))('2026-10-06')).rejects.toThrow(/503/);
  });
});

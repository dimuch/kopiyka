// National Bank of Ukraine official rates:
// https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&date=20261006&json
// → [{"r030":978,"txt":"Євро","rate":50.483,"cc":"EUR","exchangedate":"06.10.2026"}]
// A date the NBU hasn't published yet returns [].

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
const TIMEOUT_MS = 5000;

/** Fetches the EUR→UAH rate for a 'YYYY-MM-DD' date; null when the NBU has none for it. */
export type RateFetcher = (date: string) => Promise<number | null>;

export function nbuFetcher(fetchImpl: typeof fetch = fetch): RateFetcher {
  return async (date) => {
    const url = `${NBU_URL}?valcode=EUR&date=${date.replaceAll('-', '')}&json`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`NBU responded ${res.status}`);
    const body = (await res.json()) as Array<{ cc?: string; rate?: number; exchangedate?: string }>;
    const eur = Array.isArray(body) ? body.find((r) => r.cc === 'EUR') : undefined;
    if (!eur || typeof eur.rate !== 'number' || !(eur.rate > 0)) return null;
    // Guard against the NBU answering for a different day than asked.
    const [d, m, y] = (eur.exchangedate ?? '').split('.');
    if (`${y}-${m}-${d}` !== date) return null;
    return eur.rate;
  };
}

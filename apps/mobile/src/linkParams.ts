// Route params come from URLs anyone can type on web: check them before they reach a fetch.

/** The id in a link param when it's exactly one positive integer, else null. */
export function parseIdParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && Number.isSafeInteger(id) ? id : null;
}

// Mirrors the API's `month` query check (apps/api/src/expenses/routes.ts).
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The 'YYYY-MM' month in a link param when it's exactly one valid month, else null. */
export function parseMonthParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && MONTH_RE.test(value) ? value : null;
}

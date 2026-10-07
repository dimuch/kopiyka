# API error shape and expense route tightening

Type: fix

## Why

The audit (`docs/audits/2026-10-architecture.md`, A4–A9) found a group of small API drifts from
the conventions. Each is minor; together they make one coherent PR in the API alone:

- **Error replies that aren't snake_case codes.** Fastify's own 4xx errors put human text in
  `error`, and unknown routes return Fastify's default 404 shape (`app.ts:48-51`).
- **PUT updates by `expense_id` alone.** It isn't scoped by `ledger_id` or `deleted_at`
  (`expenses/routes.ts:167-182`). A concurrent delete can make it answer `200 null`.
- **Database failures disguised as rate failures.** A DB error while looking up a rate is
  reported as 503 `rate_unavailable` / `nbu_unreachable` (`expenses/routes.ts:88-93`,
  `rates/routes.ts:23-26`).
- **The NBU date rule is duplicated** in expenses and rates (`expenses/routes.ts:45-48,83`,
  `rates/routes.ts:8-11,17-18`), and `expenses/routes.ts` is over the ~200-line split point.
- **Next-month arithmetic sits inline in a route** (`expenses/routes.ts:111`) and is untested
  for Dec→Jan.
- **Expense route tests miss §6 cases:** 401, non-member 404 and bad-id 400 on five routes,
  among others.

## What

- Every API error body is `{ error: 'snake_case_code' }`. Malformed or oversized bodies and
  unsupported media types give `invalid_request` with their 4xx status. Unknown routes give
  `404 { error: 'not_found' }`.
- PUT updates only a live expense of the ledger in the URL, and answers `404 not_found` when
  nothing was updated.
- Only "NBU unreachable" and "no rate" are reported as 503. Any other failure is a 500
  `internal`, logged at error level.
- The rate-date rule (≥ 2000-01-01, ≤ Kyiv tomorrow) lives once, in `rates/service.ts`, and
  both routes use it.
- `nextMonthStart(month)` lives in `dates.ts`.

## Acceptance criteria

- [ ] `POST /api/auth/login` with body `{` and `content-type: application/json` → `400 { error: 'invalid_request' }`.
- [ ] `GET /api/nope` → `404 { error: 'not_found' }`.
- [ ] PUT of an expense that is soft-deleted between load and update → `404 not_found`, not
      `200 null`. Deterministic test: a `fetchRate` stub (it runs inside pricing, between the load
      and the UPDATE, for an uncached date) soft-deletes the row through SQL before returning.
- [ ] With a `fetchRate` stub that throws a plain `Error` (not network) the expense POST still
      answers 503 `rate_unavailable`; with a DB failure inside the rate lookup the answer is
      `500 internal` (unit or integration test).
- [ ] `nextMonthStart('2026-12') === '2027-01-01'` and `nextMonthStart('2026-02') === '2026-03-01'` (unit test in `dates.test.ts`).
- [ ] `GET /api/rates/eur-uah?date=1999-12-31` and an expense POST with that date both → 400.
- [ ] For each of GET list, GET one, PUT, DELETE and restore: 401 without a session, 404 for a
      non-member ledger, and (for `:expenseId` routes) 400 for `:expenseId = abc`.
- [ ] PUT with an invalid body → 400; PUT with a date after Kyiv tomorrow → `400 date_in_future`;
      restore of another ledger's expense → 404; rates `503 { reason: 'no_rate' }` covered.
- [ ] `apps/api/src/expenses/routes.ts` is ≤ ~215 lines (relaxed from ~200 at Gate A); `yarn lint typecheck test` green.

## Out of scope

- Any app change: the app already falls back to generic text for unknown codes.
- Changing the rates response (`eurUah` stays a number; audit A13).
- The categories quick-row query (A11), `requireAuth` placement (A10), unused exports (A12).
- Adding a `service.ts` for expenses beyond what the shared rate-date rule needs.

## Notes

- Audit A6 suggests having `nbuFetcher` wrap fetch and JSON failures in an `NbuUnreachableError`
  that the routes catch, alongside `RateUnavailableError`.
- Use the `describe.each` pattern for the 401/404/400 matrix so it stays short.

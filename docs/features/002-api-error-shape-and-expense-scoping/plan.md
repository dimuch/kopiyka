# Plan: API error shape and expense route tightening

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/api-error-shape-and-expense-scoping
Base: origin/main (e51c74b)

## Approach

Seven small commits, all in `apps/api`. The first one only adds tests that pin today's guards before the refactors.

1. **Error shape** (`app.ts`): the global handler maps every Fastify 4xx to `{ error: 'invalid_request' }` and keeps its
   status. `setNotFoundHandler` answers `404 { error: 'not_found' }`. The `frameworkErrors` option covers malformed URLs,
   which never reach `setErrorHandler`.
2. **503 vs 500**: the classification lives in `getEurUahRate`, by where the error comes from. Anything thrown by the
   injected `fetchRate` is wrapped in a new `NbuUnreachableError`. Errors from the DB queries around it pass through
   unchanged. Both routes catch only `RateUnavailableError` / `NbuUnreachableError`, through one helper
   (`rateUnavailableReason`), and rethrow everything else. The global handler then answers `500 internal` and logs at error
   level. This keeps the plain-`Error` stubs (`offlineRates`, the existing 503 tests) meaning "NBU unreachable", as
   the AC requires.
3. **Rate-date rule** (`RateDate` Zod schema + `isAfterRateHorizon`) moves into `rates/service.ts`; both routes use it.
   **`nextMonthStart`** moves into `dates.ts`.
4. **PUT** updates through the same `JOIN categories … ledger_id = ? AND deleted_at IS NULL` scope as `loadExpense` /
   `setDeleted`, and answers 404 when no row matched.
5. **Size**: those changes alone leave `expenses/routes.ts` at ~212 lines. One mechanical commit has `price` return the
   seven column values in the order that INSERT and UPDATE both list them. Each call site then shrinks from 11–12 lines to 1,
   and the file ends at **~196 lines** (measured on a Prettier-formatted draft).

Alternative considered for 2: the audit's suggestion (brief Notes) of throwing `NbuUnreachableError` from `nbuFetcher`.
It loses because the classification would then depend on the fetcher implementation. A stub or `offlineRates` that
throws a plain `Error` would become a 500, which breaks the AC "plain `Error` → still 503" and the existing 503 tests in
`expenses.int.test.ts` and `rates.routes.int.test.ts`. Classifying by source inside `getEurUahRate` works for any
`RateFetcher`. `nbu.ts` stays unchanged.

Alternative considered for 3: one `checkRateDate(date, now)` that returns a code. Rejected because a too-early date
would then get a new error code. Today it is Zod's `400 invalid_request` (with `issues`), and no AC asks for a change.

## Contracts

- DB: none.
- API: responses change only as listed here; every success body is unchanged.
  - Global error handler (`app.ts`):
    - `ZodError` → 400 `{ error: 'invalid_request', issues }`. Unchanged.
    - An error whose `statusCode` is 400–499 → that status, `{ error: 'invalid_request' }`. Today the body carries
      Fastify's message.
    - Anything else → `req.log.error(err)` + 500 `{ error: 'internal' }`. Unchanged.
  - `app.setNotFoundHandler` → 404 `{ error: 'not_found' }`, for any method or path with no route.
  - `Fastify({ frameworkErrors })` → `err.statusCode ?? 400`, `{ error: 'invalid_request' }`. It needs
    `(reply as FastifyReply)`, because the option's generic signature rejects `reply.code(number)` (tsc verified). There
    are no async route constraints, so only `FST_ERR_BAD_URL` (400) and `FST_ERR_MAX_PARAM_LENGTH` (414) can reach it.
  - The installed Fastify 5.12.5 was checked with a scratch `inject`. These errors reach `setErrorHandler` carrying a
    `statusCode`:

    | Request                               | code                             | status |
    | ------------------------------------- | -------------------------------- | ------ |
    | Malformed JSON body                   | `FST_ERR_CTP_INVALID_JSON_BODY`  | 400    |
    | Empty body with `application/json`    | `FST_ERR_CTP_EMPTY_JSON_BODY`    | 400    |
    | Body over the 1 MiB `bodyLimit`       | `FST_ERR_CTP_BODY_TOO_LARGE`     | 413    |
    | Unsupported or missing `content-type` | `FST_ERR_CTP_INVALID_MEDIA_TYPE` | 415    |

    `FST_ERR_BAD_URL` (e.g. `/api/%E0%A4%A`) bypasses the handler and answers Fastify's default shape unless
    `frameworkErrors` is set.

    With `@fastify/cors` registered:
    - the 404 handler's reply still carries `access-control-allow-origin`;
    - a preflight to an unknown path still answers 204 from the plugin's own `OPTIONS *` route.

    Without CORS, `OPTIONS` answers `404 not_found`.

  - `POST /api/ledgers/:id/expenses`: a DB failure during the rate lookup → 500 `{ error: 'internal' }`. Today it is
    503 `rate_unavailable`. Every other code is unchanged: 400 invalid_request / unknown_category / date_in_future, 401,
    404, and 503 `rate_unavailable` for no rate or NBU unreachable.
  - `PUT /api/ledgers/:id/expenses/:expenseId`: answers 404 `{ error: 'not_found' }` in two new cases. The first is when the
    UPDATE matches no live row of this ledger (e.g. the expense was soft-deleted while being priced); today that answers
    `200 null`. The second is when the reload after the update finds nothing. A DB failure during the rate lookup → 500 as above.
    The app already shows "This expense was deleted meanwhile." for `not_found` (`apps/mobile/src/app/expense.tsx:35`).
  - `GET /api/rates/eur-uah`: 503 `{ error: 'rate_unavailable', reason: 'no_rate' | 'nbu_unreachable' }` only for those
    two cases; anything else → 500 `internal`. A date before 2000-01-01 stays 400 `invalid_request`, and a date after
    Kyiv tomorrow stays 400 `date_in_future`.
- `rates/service.ts` (consumers: `rates/routes.ts`, `expenses/routes.ts`, `test/rates*.ts`):
  ```ts
  /** A real 'YYYY-MM-DD' date from 2000-01-01 on: the dates both routes look NBU rates up for. */
  export const RateDate = z
    .string()
    .refine(isCalendarDate, 'expected a YYYY-MM-DD date')
    .refine((d) => d >= '2000-01-01', 'too early');
  /** True after tomorrow in Kyiv: the NBU publishes tomorrow's rate in the afternoon, later ones can't exist yet. */
  export function isAfterRateHorizon(date: string, now: Date): boolean; // date > addDays(kyivToday(now), 1)
  export class NbuUnreachableError extends Error {
    // message `NBU unreachable for ${date}: ${cause message}`, { cause }: keeps the fetcher's reason in logs
    constructor(date: string, cause: unknown);
  }
  /** Why a rate lookup failed with a 503, or null for anything else (a bug or a DB failure: a 500). */
  export function rateUnavailableReason(err: unknown): 'no_rate' | 'nbu_unreachable' | null;
  ```
  In `getEurUahRate`, a `try/catch` around `await fetchRate(day)` alone rethrows as `new NbuUnreachableError(day, err)`.
  The `try/catch` also catches a synchronous throw. `cachedRate`, the `INSERT IGNORE` and the read-back stay outside it.
  `RateDate` is a field schema exported from a service. Conventions §2 puts request schemas in `routes.ts`, and those
  schemas (`ExpenseBody`, `RateQuery`) do stay there. The brief puts the shared domain rule in `rates/service.ts`.
- `dates.ts`: `export function nextMonthStart(month: string): string`: `'YYYY-MM'` → first day of the next month
  (`addDays(`${month}-28`, 4).slice(0, 7) + '-01'`, the expression the list route uses today).
- `expenses/routes.ts` (PUT):
  The PUT's `affectedRows === 1` check counts _matched_ rows, because mysql2 3.24.5 sets `FOUND_ROWS` by default
  (`lib/connection_config.js`). An unchanged save under the fixed test clock is therefore still 200 (verified).
- App: none. New dependencies: none.

## Slices

All test cases below were drafted in a scratch copy and run against the local test MySQL. All 133 tests pass on
the draft. On Base, only the cases marked Prove-It fail.

- [x] 1. Cover expense routes' session, membership and id checks in tests
  - Files: `apps/api/test/expenses.int.test.ts`
  - Change: tests only. They pin today's guards before the refactors below.
  - Tests:
    - A `describe.each` over GET list (`?month=2026-10`), GET one, PUT (body `groceries()`), DELETE and restore. Each has
      `401 { error: 'unauthorized' }` without a session, `404 { error: 'not_found' }` for the stranger's ledger, and for
      the four `:expenseId` routes 400 for `abc` (`it.skipIf` for GET list).
    - PUT: `amount: '0'` → 400 `invalid_request`; `expenseDate: '2026-10-08'` → `400 { error: 'date_in_future' }`.
    - "cannot delete or restore another ledger's expense" also checks the restore. The owner deletes the expense, the
      stranger's restore through the stranger's ledger answers 404, and the list stays empty.
  - All pass on Base. Est. ~50 lines.
- [x] 2. Answer malformed requests and unknown routes with snake_case error codes
  - Files: `apps/api/src/app.ts`, `apps/api/test/errors.test.ts` (new; no DB, the unreachable pool as in
    `cors.test.ts`), `apps/api/test/cors.test.ts`
  - Change: the error-handler 4xx branch, `setNotFoundHandler`, and `frameworkErrors`, as in Contracts, each with a
    why-comment.
  - Tests (`errors.test.ts`, `it.each`):
    - `POST /api/auth/login` with body `{`, an empty body, a body over 1 MiB, and `application/xml` → 400 / 400 / 413 / 415,
      each `{ error: 'invalid_request' }`;
    - `GET /api/ledgers/%E0%A4%A` → 400 `invalid_request`;
    - `GET /api/nope` → `404 { error: 'not_found' }`.

    `cors.test.ts`: "keeps CORS headers on the not_found reply". Prove-It: the six `errors.test.ts` cases fail on Base.

  - Est. ~60 lines.
- [x] 3. Report database failures during rate lookups as 500, not 503
  - Files: `apps/api/src/rates/service.ts`, `apps/api/src/rates/routes.ts`, `apps/api/src/expenses/routes.ts`,
    `apps/api/test/rates.int.test.ts`, `apps/api/test/rates.routes.int.test.ts`, `apps/api/test/expenses.int.test.ts`
  - Change: add `NbuUnreachableError`, the fetch-only wrap and `rateUnavailableReason`. Both catch blocks start with
    `if (!reason) throw err;` and then keep their `req.log.warn` + 503 as today.
  - Tests:
    - `expenses.int.test.ts` "answers 500 internal when the database fails during the rate lookup". The `fetchRate` stub
      runs `RENAME TABLE exchange_rates TO exchange_rates_off` and returns 50.483, so the `INSERT IGNORE` fails with
      `ER_NO_SUCH_TABLE`. The answer must be `[500, { error: 'internal' }]`. The `try` opens before the stub is set and
      before the inject, so its `finally` (which renames the table back) always runs once the rename can have happened.
      This is Prove-It: Base answers 503.
    - `rates.routes.int.test.ts` "answers 500 internal when the database fails": the same `RENAME` stub and `try/finally`
      around `get('?date=2026-10-06')` gives `[500, { error: 'internal' }]`. This pins the second consumer of
      `rateUnavailableReason`, and it is Prove-It too: Base answers 503 `nbu_unreachable`. A stub that returns an out-of-range rate doesn't work for this, because `INSERT IGNORE`
      clamps the value instead of failing (verified).
    - The existing "answers 503 without saving when there is no rate" (a plain `Error` stub) stays unchanged and green. It
      covers the "plain `Error` → 503" half of the AC.
    - `rates.int.test.ts` "lets an NBU error through without storing anything" also asserts
      `rejects.toBeInstanceOf(NbuUnreachableError)`. Its `/503/` assertion still passes because the message keeps the
      cause's message.
    - `rates.routes.int.test.ts` "answers 503 no_rate when the NBU has none for the last 7 days": `fetchRate` → `null`
      gives `[503, { error: 'rate_unavailable', reason: 'no_rate' }]`. The existing `nbu_unreachable` test stays as it is.
  - Est. ~68 lines.
- [ ] 4. Keep the NBU rate-date rule in one place
  - Files: `apps/api/src/rates/service.ts`, `apps/api/src/rates/routes.ts`, `apps/api/src/expenses/routes.ts`,
    `apps/api/test/rates.routes.int.test.ts`, `apps/api/test/expenses.int.test.ts`
  - Change: add `RateDate` and `isAfterRateHorizon`. `RateQuery = z.object({ date: RateDate })`,
    `ExpenseBody.expenseDate: RateDate`, and both routes test `isAfterRateHorizon(date, now())`. The routes no longer import
    `isCalendarDate` or `kyivToday`. The rates route also drops `addDays`; the expense route keeps it for the list route until slice 5. The NBU-publishes-tomorrow
    comment moves with the rule.
  - Tests: `?date=1999-12-31` → 400 (rates); POST `expenseDate: '1999-12-31'` → 400 (expenses). Both pass before and after
    this commit, so they pin the moved rule. The existing `date_in_future` tests cover the other bound.
  - Est. ~35 lines.
- [ ] 5. Move next-month arithmetic into dates.ts
  - Files: `apps/api/src/dates.ts`, `apps/api/src/expenses/routes.ts`, `apps/api/test/dates.test.ts`
  - Change: add `nextMonthStart`; the list route uses `nextMonthStart(month)`, and drop the now-unused `addDays` import
    from `expenses/routes.ts`.
  - Tests (`dates.test.ts`): `nextMonthStart('2026-12') === '2027-01-01'` and `nextMonthStart('2026-02') === '2026-03-01'`.
    The existing "keeps month edges right" still covers the route.
  - Est. ~14 lines.
- [ ] 6. Update only a live expense of the URL's ledger on PUT
  - Files: `apps/api/src/expenses/routes.ts`, `apps/api/test/expenses.int.test.ts`
  - Change: the UPDATE becomes `UPDATE expenses e JOIN categories c ON c.category_id = e.category_id SET e.… WHERE
e.expense_id = ? AND c.ledger_id = ? AND e.deleted_at IS NULL`, and it reads `affectedRows`. The handler then does
    `const updated = res.affectedRows === 1 ? await loadExpense(...) : null; return updated ?? reply.code(404).send({ error: 'not_found' })`.
    A why-comment refers to the delete race.
  - Tests:
    - "answers 404 when the expense is deleted while it is being priced". 2026-10-05 is uncached, so `fetchRate` runs
      between the load and the UPDATE. The stub runs `UPDATE expenses SET deleted_at = ? WHERE expense_id = ?` and then
      returns 50.6. The answer is `[404, { error: 'not_found' }]`. This is Prove-It: Base answers `[200, null]`.
    - "saves an unchanged expense": `put(expenseId, groceries())` → 200. This proves the `FOUND_ROWS` reliance.
    - The existing "updates every field" moves the expense to another category, which proves that the JOIN still matches
      when `e.category_id` is updated.
  - Gate: `wc -l apps/api/src/expenses/routes.ts` gives ≤ ~215.
  - Est. ~25 lines.

Total ≈ 245–290 changed lines (tests ≈ 190 of them) in 6 commits, within the ~400 limit, so no split is needed. Each
commit passes `yarn format:check && yarn lint && yarn typecheck && yarn test`.

## AC → evidence

| AC                                                                                                       | Evidence                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login body `{` + JSON → `400 invalid_request`                                                            | `errors.test.ts` "answers malformed JSON with invalid_request" (slice 2)                                                                                                                                       |
| `GET /api/nope` → `404 not_found`                                                                        | `errors.test.ts` "answers unknown routes with not_found" (slice 2)                                                                                                                                             |
| What: oversized body / media type → `invalid_request` with their 4xx; every error body snake_case        | `errors.test.ts` empty, 1 MiB (413), xml (415) and bad-URL cases (slice 2)                                                                                                                                     |
| PUT of an expense deleted between load and update → 404                                                  | `expenses.int.test.ts` "answers 404 when the expense is deleted while it is being priced" (slice 7)                                                                                                            |
| Plain-`Error` stub → POST 503 `rate_unavailable`; DB failure → `500 internal`                            | existing "answers 503 without saving when there is no rate" + new "answers 500 internal when the database fails during the rate lookup" + rates route "answers 500 internal when the database fails" (slice 3) |
| `nextMonthStart` Dec→Jan, Feb→Mar                                                                        | `dates.test.ts` "finds the start of the next month…" (slice 5)                                                                                                                                                 |
| `?date=1999-12-31` and expense POST with it → 400                                                        | `rates.routes.int.test.ts` "rejects malformed and impossible dates" + `expenses.int.test.ts` "rejects dates before 2000" (slice 4)                                                                             |
| Five routes: 401, non-member 404, `abc` → 400                                                            | `expenses.int.test.ts` `describe.each` matrix (slice 1)                                                                                                                                                        |
| PUT invalid body 400, PUT `date_in_future`, restore of another ledger's expense 404, rates `no_rate` 503 | slice 1 PUT and restore cases; `rates.routes.int.test.ts` "answers 503 no_rate…" (slice 3)                                                                                                                     |
| `expenses/routes.ts` ≤ ~215 lines; gates green                                                           | `wc -l` ≤ ~215 after slice 6; gates on every commit                                                                                                                                                            |
| Rate-date rule once, in `rates/service.ts`                                                               | `rg -n "2000-01-01\|kyivToday" apps/api/src` shows only `rates/service.ts` and `dates.ts` (slice 4)                                                                                                            |

## Not doing (YAGNI)

- `nbuFetcher` / `nbu.ts` changes (see Approach); no `reason` field on the expense 503.
- An `expenses/service.ts` or a separate DTO module (the brief's out-of-scope list); the file stays at ~215 lines, under the conventions' split trigger in spirit (user decision at Gate A).
- Logging Fastify's 4xx errors, or distinct codes per 4xx (the brief asks for `invalid_request` for all of them).
- Any app change, the rates response shape (A13), categories quick-row (A11), `requireAuth` placement (A10), unused exports (A12).

## Risks

- A test that runs `RENAME TABLE` could leave the schema broken if it dies between the rename and the `finally`. The
  `finally` restores the table. Even if it didn't, the next suite's `resetSchema` drops every table (including
  `exchange_rates_off`) and re-runs the migrations. Slice 3 runs it on CI's MySQL 8.0; the draft passed locally.
- The PUT's 404-on-no-match depends on the mysql2 default `FOUND_ROWS`. Slice 7's "saves an unchanged expense" fails if
  that ever changes.
- A multi-table UPDATE that sets the join column `e.category_id`. Slice 7's existing "updates every field" test (which
  moves the expense to `cat.car`) proves that it still matches and updates.
- The `frameworkErrors` reply cast. Slice 2's typecheck and the bad-URL test prove it.

## Open questions

- Blocking: no. "Every API error body is `{ error: 'snake_case_code' }`": does that forbid extra fields? Assumption: no.
  `issues` on Zod 400s and `reason` on the rates 503 stay. The brief's own AC keeps `reason`.
- Blocking: no. Malformed and over-long URL params (400/414) aren't in the ACs. They are included under "every API error
  body" because they cost 4 lines and one test. Drop them from slice 2 if the brief meant only bodies and unknown routes.
- Blocking: no. The brief's Notes suggest `NbuUnreachableError` in `nbuFetcher`; this plan wraps in `getEurUahRate`
  instead (see Approach). Assumption: the Notes were a hint, and the ACs decide.
- Blocking: no. The brief cites `docs/audits/2026-10-architecture.md`, which isn't in the repo at Base. The plan relies
  only on the brief's text and the code, so the cited line numbers were checked against the code instead.

## Follow-ups

- When `CORS_ORIGINS` is set (dev only), `@fastify/cors` answers an `OPTIONS` request that has no preflight headers with
  `400 text/plain "Invalid Preflight Request"`, not JSON.
- POST (`201`) and restore (`200`) return `loadExpense(...)` unchecked. A delete that lands between the write and the
  reload would answer `null`. This is the same race class as the PUT, but no AC covers it.
- `INSERT IGNORE INTO exchange_rates` turns errors into warnings, so an out-of-range rate is silently clamped (`1e9` →
  `999999.9999`, verified). `ON DUPLICATE KEY UPDATE rate_date = rate_date` would ignore only the duplicates.

## Deviations

<filled by the developer during build>

## Revision 1

From the skeptic's APPROVE WITH EDITS:

- Slice 4 no longer claims the expense route drops `addDays`; the list route still uses it until slice 5, which now drops
  the import. Without this, slice 4 would fail lint/typecheck.
- Slice 3 adds the rates-route 500 test, which pins the second consumer of `rateUnavailableReason`; the estimate is now
  ~68 lines. The `RENAME` tests open their `try` before setting the stub and injecting.
- `price` returns a typed `ExpenseValues` readonly tuple instead of `(string | number)[]`; the file is ~196 lines. A
  named object was rejected (see Contracts).

## Revision 2

User decision at Gate A: slice 6 ("Build expense column values once when pricing", the positional `ExpenseValues`
tuple) is dropped. Its only purpose was the brief's ≤ ~200-line target, and a positional tuple shared by two SQL
statements trades readability for ~20 lines. The brief's AC is relaxed to ≤ ~215 lines; the former slice 7 is now
slice 6, and its UPDATE lists the values as today.

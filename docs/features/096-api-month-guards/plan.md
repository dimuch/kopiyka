# Plan: Share the API's month checks and month dates

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/api-month-guards
Base: origin/main (efae6df, version 1.15.1)

## Approach

The code moves and nothing else changes. Two new helpers go in `dates.ts`: `monthOf` and `monthStart`. Every
hand-written `${month}-01` and date `.slice(0, 7)` in `apps/api/src` is swapped for them. `lockLedger` moves to
`ledgers/lock.ts`, and invites calls it in place of its inline copy of the same query. A new `src/monthGuards.ts` holds
the two checks the month routes share. The first is `MonthString`, the Zod field. The second is
`checkMonthOpen(reply, at, ...months)`, which replies 409 `month_ended` and returns false the way `checkCategory` does
(conventions §4: the handler then `return reply`). Each refusal stays on the line of the `if` it replaces, so every
route keeps its order of checks and its `now()` reads. `dates.ts` stays pure: no Zod, no `reply`.

No test pins the Zod `issues` the error handler sends (`app.ts:75-76`), and none pins "a bad body is answered before an
ended month" (categories PATCH, categories add, income POST). So slice 1 adds characterization tests for both, and they
must pass on the Base. In a scratch script against zod 4.6.7, the inline schema and the shared `MonthString` gave
deep-equal issues for every route shape: path `month`, `MonthQuery` with `categoryId`, summary's `from`/`to` with its
refines, and missing or non-string values.

I built every slice in a scratch copy of the Base (outside the repo). `tsc --noEmit`, ESLint, Prettier and the unit tests
passed there. Line counts below come from that copy. The integration tests were not run there: slice 1 proves them on
the Base.

Alternatives considered:

- A Fastify preHandler that refuses ended `:month` params. It runs before the handler parses the body, so a bad body
  in an ended month would get 409 instead of 400. It also can't serve expenses, whose month comes from the body or the
  stored row.
- Putting `MonthString` in `dates.ts` next to `MONTH_RE`, which the brief allows. It lost because it would bring Zod
  into the pure dates module. `monthGuards.ts` is the brief's other option ("a small shared params module").

## Contracts

- DB: none
- API: none. Every status, body, error code, Zod issue and SQL statement stays byte-identical. A malformed month's issue
  on the Base, all six fields:
  `{"origin":"string","code":"invalid_format","format":"regex","pattern":"/^\\d{4}-(0[1-9]|1[0-2])$/","path":["from"],"message":"expected YYYY-MM"}`
  (`path` is the field's name: `month`, `from` or `to`).
- App: none (`apps/mobile/src/demo/` mirrors no code that moves; no rule or refusal changes).
- Code (new or moved exports, all in `apps/api/src`):
  - `dates.ts`: `monthOf(date: string): string` returns `date.slice(0, 7)` (`'YYYY-MM-DD'` → `'YYYY-MM'`).
    `monthStart(month: string): string` returns `` `${month}-01` ``. `nextMonthStart`, `previousMonthStart` and
    `monthEnded` keep their signatures and are rewritten through the two helpers. `MONTH_RE` stays here.
  - `monthGuards.ts` (new): `export const MonthString = z.string().regex(MONTH_RE, 'expected YYYY-MM')`.
    `export function checkMonthOpen(reply: FastifyReply, at: Date, ...months: string[]): boolean`. When any of the
    months has ended (`monthEnded(month, at)`), it calls `reply.code(409).send({ error: 'month_ended' })` and returns
    false. Otherwise it returns true and doesn't reply. Callers: categories (5), income (2), expenses (4; PUT passes
    two months and one `at`).
  - `ledgers/lock.ts` (new): `lockLedger(conn: PoolConnection, ledgerId: number): Promise<void>`, moved word for word
    from `categories/monthLists.ts`. Callers: `categories/monthLists.ts` (5), `income/routes.ts` (3),
    `expenses/repeatCall.ts` (1), `invites/routes.ts` (1, new).
  - `test/helpers.ts`: `badMonthReply(...fields: string[])` returns
    `{ error: 'invalid_request', issues: fields.map((field) => ({ origin: 'string', code: 'invalid_format', format: 'regex', pattern: '/^\\d{4}-(0[1-9]|1[0-2])$/', path: [field], message: 'expected YYYY-MM' })) }`,
    the exact 400 body for malformed months, one issue per field in the order given.
- Reuses: `MONTH_RE`, `monthEnded`, `addDays`, `kyivToday` (`dates.ts`); the `checkCategory`/`price` reply-then-false
  pattern; the existing int-test request helpers (`one`, `removeFrom`, `copy`, `edit`, `add`, `list`, `balance`,
  `summary`, `idOf`)
- New dependencies: none

## Version

Bump: patch — 1.15.1 → 1.15.2
Why: conventions §8b says "a refactor that touches shipped code is `patch`, never `none`". Every slice changes shipped
API code without changing behaviour. No route, field, MCP tool or schema changes.

## Slices

Sizes are insertions + deletions from the scratch build: about 320 summed over slices, about 284 net. Every slice ends
with `yarn format:check && yarn lint && yarn typecheck && yarn test` green, with integration tests **run** (MySQL
reachable) and the API test count the same or higher. Locally, run the format check as
`yarn prettier --check . '!.claude/worktrees/**'`: untracked worktrees under `.claude/worktrees/` aren't in
`.prettierignore`, so plain `yarn format:check` fails on them, as on the Base. Each slice also needs `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` clean.
Existing test cases stay unmodified.

- [x] 0. Bump version to 1.15.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.2
- [x] 1. Pin the month errors and check order the routes answer with (about 86 lines, tests only)
  - Files: `apps/api/test/helpers.ts` (adds `badMonthReply`, with `pattern: '/^\\d{4}-(0[1-9]|1[0-2])$/'` written out,
    not imported, so a changed regex fails). In each of `categories.int`, `income.int`, `balances.int`, `expenses.int`
    and `summary.int`: one new nested `describe('month checks', …)` appended as the last block of the suite's outer
    describe (so it shares its `beforeEach` and request helpers), and `badMonthReply` added to the import from
    `./helpers.js`.
  - Tests (+7). Issue tests assert `toEqual([res.statusCode, res.json()], [400, badMonthReply(…)])`, the whole body.
    Order tests assert only `toEqual([res.statusCode, res.json().error], [400, 'invalid_request'])`: they pin which
    check answers first, and a bad body's own issues are not what this brief keeps.
    - `categories.int`, describe `month checks`:
      - "answers a malformed month with its Zod issue, in a query and in a path": `GET /categories?month=2026-13`,
        `one(gym?month=2026-13)`, `removeFrom(gym, …, '2026-13')` and `copy('2026-13')` each answer
        `[400, badMonthReply('month')]`.
      - "checks the body before whether the month has ended" (order test): `edit(gym, …, '2026-09', {})` and
        `add(…, '2026-09', '')` both answer `[400, 'invalid_request']`.
    - `income.int`, describe `month checks`:
      - "answers a malformed month with its Zod issue": `list`, `add` (with a valid body) and `copy`, each on
        `'2026-13'`, answer `[400, badMonthReply('month')]`.
      - "checks the body before whether the month has ended" (order test): `add('2026-09', { title: '', amount: '1' })`
        answers `[400, 'invalid_request']`.
    - `balances.int` and `expenses.int`, describe `month checks`: "answers a malformed month with its Zod issue"
      (`balance('2026-13')`, `list('?month=2026-13')`) → `[400, badMonthReply('month')]`.
    - `summary.int`, describe `month checks`: "answers malformed months with a Zod issue each, from first":
      `from=2026-13&to=2026-13` → `[400, badMonthReply('from', 'to')]`.
  - Proof they bite. Try each break and restore it, so `git diff` shows only tests:
    - In each route file, change `'expected YYYY-MM'` to `'expected YYYY-MM!'`. That file's issue test must fail.
    - For summary, change only `to`'s message.
    - In categories PATCH, categories add and income POST, move the `monthEnded` line above `…Body.parse`. That suite's
      order test must get 409.
- [x] 2. Name the row in the stored-income callback (2 lines, rename)
  - Files: `apps/api/src/notion/incomeImport.ts` (line 34 only)
  - Change: `rows.map((r) => …r.income_month…r.items…r.total)` becomes `row`. Slice 6 touches this line, and
    `find-short-names.sh --diff` would flag the `r` on it, so the rename goes first and on its own (refactoring §4).
  - Tests: `notionIncome.int` ("skips a month that already has income, imports the others, and a re-run adds nothing",
    and the rest of the file).
- [x] 3. Move lockLedger to ledgers (22 lines, move)
  - Files: new `apps/api/src/ledgers/lock.ts`; `categories/monthLists.ts` (drop the function, import it);
    `income/routes.ts` and `expenses/repeatCall.ts` (import path only)
  - Change: move the function and its doc comment word for word, with the same SQL string.
  - Tests: `categories.int` "holds when two members add at once", "holds when two members raise plans at once";
    `income.int` "copies once when two members copy at the same time", "holds when members delete income at once";
    `expenses.repeat.int` "saves one of two calls made at once"; and all of those suites.
- [x] 4. Lock the ledger through lockLedger when inviting (8 lines, reuse)
  - Files: `apps/api/src/invites/routes.ts`, `apps/api/src/ledgers/lock.ts` (doc comment)
  - Change: line 28's inline `SELECT ledger_id FROM ledgers WHERE ledger_id = ? FOR UPDATE` becomes
    `await lockLedger(conn, ledgerId)`. It sends the same statement and params, still first in the transaction. The doc
    comment's first sentence becomes: one change per ledger at a time (a month's list, income, a connector's repeat,
    an invite), so a check and the write after it see the same rows. Its why stays.
  - Tests: `invites.int` "two invites sent at once make one", "an expired invite doesn't block a new one", and the rest
    of the file.
- [x] 5. Add monthOf and monthStart to dates (37 lines, extract)
  - Files: `apps/api/src/dates.ts`, `apps/api/test/dates.test.ts`
  - Change: add both helpers with one-line JSDoc, above `nextMonthStart`. Then:
    - `nextMonthStart` returns ``monthStart(monthOf(addDays(`${month}-28`, 4)))``.
    - `previousMonthStart` returns `monthStart(monthOf(addDays(monthStart(month), -1)))`.
    - `monthEnded` compares with `monthOf(kyivToday(now))`.
    - All are equal by definition. A scratch run matched the old outputs for 2026-12, 2026-02, 2027-01, 0001-01 and
      9999-12.
  - Tests (+2): "cuts the month out of a date" (`'2026-10-06'` → `'2026-10'`, `'2026-12-31'` → `'2026-12'`); "finds a
    month's first day" (`'2026-10'` → `'2026-10-01'`, `'2027-01'` → `'2027-01-01'`). The existing next/previous month
    and `monthEnded` table cases run unchanged.
- [x] 6. Use monthStart and monthOf for month dates across the API (84 lines, mechanical, 12 files)
  - Files and sites in `apps/api/src`:
    - `` `${x}-01` `` → `monthStart(x)`:
      - `categories/routes.ts` 102, 131
      - `categories/monthLists.ts` 83, 124, 189, 276, 347
      - `balances/routes.ts` 26
      - `expenses/routes.ts` 121
      - `income/routes.ts` 74, 90, 140
      - `income/limit.ts` 48
      - `summary/routes.ts` 81-82 (`from`, `to`)
      - `notion/incomeImport.ts` 31 (`months.map(monthStart)`), 79
      - `notion/historyImport.ts` 63, 84, 150
      - `notion/balancesImport.ts` 22 (`months.map(monthStart)`), 59
      - `notion/totals.ts` 296
      - `admin.ts` 51 (`monthStart(monthOf(kyivToday(now)))`)
    - `.slice(0, 7)` → `monthOf(…)`:
      - `expenses/routes.ts` 144, 202 (×2), 252, 261
      - `income/routes.ts` 61
      - `notion/incomeImport.ts` 34
      - `notion/balancesImport.ts` 26
      - `notion/totals.ts` 42
    - Plus each file's `dates.js` import.
  - Change: call-site swaps only. Lines numbered as on the Base.
  - Checks:
    - `rg '\$\{[a-zA-Z.]*month\}-01' apps/api/src` and ``rg '\}-01`' apps/api/src`` find only `monthStart` in
      `dates.ts`.
    - `rg 'slice\(0, 7\)' apps/api/src` finds only `monthOf`.
  - Tests: `categories.int`, `expenses.int`, `income.int`, `balances.int`, `summary.int`, `notionHistory.int`,
    `notionIncome.int`, `notionBalances.int`, `notionTotals.int`. `income/limit.ts:48` runs inside `checkIncome`
    only from `'2026-11'` (`limit.ts:5`), so its proof is `categories.int` and `income.int` describe
    `over-income rule (brief 060)`, which store November plans and income (`income.int.test.ts:381-397`).
    `incomeLimit.test` imports only `overIncomeBy`/`overIncomeError` and doesn't reach it. `admin.ts` runs in every
    suite's `makeUser`, which seeds October's 15 defaults.
- [x] 7. Share the YYYY-MM month check across the month routes (33 lines, extract)
  - Files: new `apps/api/src/monthGuards.ts` (`MonthString`); `categories/routes.ts` 49, `income/routes.ts` 20,
    `balances/routes.ts` 13, `expenses/routes.ts` 62 (`MonthQuery` keeps `month` first, then `categoryId`),
    `summary/routes.ts` 47-48; each drops its `MONTH_RE` import.
  - Change: each `z.string().regex(MONTH_RE, 'expected YYYY-MM')` becomes `MonthString`. Object shapes, key order and
    refines stay as they are.
  - Check: `rg "regex\(MONTH_RE" apps/api/src` finds only `monthGuards.ts`.
  - Tests: slice 1's issue pins; categories "rejects a malformed month", "requires a month"; balances "rejects a
    malformed month"; expenses "requires a valid month"; summary "rejects a bad month, from after to, or more than 24
    months"; income "refuses an ended month and a malformed one".
- [x] 8. Share the ended-month refusal across the month routes (48 lines, extract)
  - Files: `apps/api/src/monthGuards.ts` (adds `checkMonthOpen` with JSDoc); `categories/routes.ts` 178, 186, 199, 210,
    219; `income/routes.ts` 83, 138; `expenses/routes.ts` 144, 202-204, 252, 261
  - Change: each `if (monthEnded(…)) return reply.code(409).send({ error: 'month_ended' })` becomes
    `if (!checkMonthOpen(reply, <same clock expression>, <same month(s)>)) return reply;` on the same line.
    - Categories DELETE keeps `const at = now()` and passes `at` to `removeFromMonth`.
    - Expenses PUT keeps `const at = now()` and its "Both ends" comment, and passes both months.
    - `findChangeable`'s `return 'month_ended'` result code in income stays.
    - `monthEnded` imports go where unused.
  - Check: `rg "error: 'month_ended'" apps/api/src` finds only `monthGuards.ts`.
  - Tests:
    - Every month_ended case in `categories.int`: "refuses a month that has ended in Kyiv…" ×5, "refuses a month that
      has ended", "answers name_taken and month_ended before over_income on an add", "answers not_found and
      month_ended before over_income", "answers name_taken and month_ended before over_income on an Undo".
    - In `expenses.int`, describe `ended months`: "refuses a new September expense, writing nothing" (no rate fetched),
      "refuses moving an expense into or out of an ended month", "says month_ended before category_not_in_month",
      both "answers 404, not month_ended…", "refuses an Undo just after midnight Kyiv".
    - In `income.int`: "refuses an ended month", "refuses an ended month and a malformed one".
    - Slice 1's "checks the body before whether the month has ended" ×2.

## AC → evidence

| AC                                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regex(MONTH_RE` only in the shared piece                                          | slice 7 check: `rg "regex\(MONTH_RE" apps/api/src` → `src/monthGuards.ts` alone                                                                                                                                                                                                                                                                                  |
| `error: 'month_ended'` only in the shared helper                                   | slice 8 check: `rg "error: 'month_ended'" apps/api/src` → `src/monthGuards.ts` alone (income's `return 'month_ended'` stays)                                                                                                                                                                                                                                     |
| `${…month}-01` only in `monthStart`; `monthOf`/`monthStart` unit-tested            | slice 6 check: `rg '\$\{[a-zA-Z.]*month\}-01' apps/api/src` → `dates.ts` `monthStart` alone; `dates.test.ts` "cuts the month out of a date", "finds a month's first day" (slice 5)                                                                                                                                                                               |
| `lockLedger` from `ledgers/`; none from `monthLists.ts`; no inline lock in invites | slices 3-4: `rg -n "lockLedger" apps/api/src` shows the export in `ledgers/lock.ts` and every import from `../ledgers/lock.js`; `rg -n "FROM ledgers WHERE ledger_id = \? FOR UPDATE" apps/api/src` → `ledgers/lock.ts` alone; `invites.int` "two invites sent at once make one"                                                                                 |
| Behaviour unchanged; existing tests unmodified; integration ran                    | Slice 1's 7 characterization tests pass on the Base and after every slice. API count goes from 633 passed / 1 skipped to 642 / 1 (+7 int, +2 unit), with integration tests run. MCP 327 and mobile 453 are unchanged. `git diff origin/main -- apps/api/test` shows only additions: `badMonthReply`, the appended cases, `dates.test.ts`'s import and two cases. |

## Not doing (YAGNI)

- The shared SQL between the routes and the Notion import (soft delete, live month row, upserts). It's out of scope with
  its own brief.
- Other single-letter names in `notion/*` and `summary/routes.ts`, except the one line slice 6 must touch (slice 2).
  Those belong to the importer/cleanup briefs (C, G).
- `apps/mcp`'s own `dates.ts` and the app's `format.ts`, which are separate on purpose.
- Splitting `categories/routes.ts` or `expenses/routes.ts` into `service.ts`.
- A shared `MonthParams` object. Expenses and summary need the field, not the object (brief Notes). The local
  `Month`/`MonthParams`/`MonthQuery`/`PeriodQuery` schemas stay where they are.
- Moving `MONTH_RE` out of `dates.ts`, or changing `monthEnded`'s signature.

## Risks

- **The shared Zod piece changes the `issues` in a 400.** Slice 1 pins the full body on the Base and slice 7 must pass
  it. The scratch Zod check already showed deep-equal issues. The `pattern` field is the regex source as a string, so
  it serialises.
- **A refusal moves relative to a body parse, a 404, a category check or a rate fetch.** Slice 1's order tests and the
  existing ordering cases catch it in slice 8. Each call stays on its `if`'s line.
- **`now()` reads change** (a second read in expenses PUT or categories DELETE). This is not observable with the fixed
  test clock. The reviewer checks it by diff: each site passes the same clock expression it had.
- **`months.map(monthStart)` passes the index as a second argument.** `monthStart` takes one parameter, so nothing
  changes. `tsc` and `notionIncome.int`/`notionBalances.int` cover it in slice 6.
- **An import cycle.** `ledgers/lock.ts` and `monthGuards.ts` import only `mysql2` types and `dates.ts`/`zod`/`fastify`
  types, so none can form. `tsc` and the full suite in slices 3 and 7 prove it.

## Open questions

- no — `monthOf` also replaces four cuts that aren't expense or income dates: `balance_month` (`balancesImport.ts:26`),
  today in `admin.ts:51` and `monthEnded`, and the cut inside `nextMonthStart`/`previousMonthStart`. The brief names
  only expense and income dates, but these are the same cut. Assumption: include them, so `slice(0, 7)` exists only in
  `monthOf`. Dropping them would leave about 5 lines unchanged.
- no — summary's `${from}-01`/`${to}-01` aren't matched by AC3's regex, but they are the same month start.
  Assumption: swap them too (slice 6).
- no — characterization tests go into the existing suites as appended cases, plus `badMonthReply` in `helpers.ts`.
  No existing case changes. Assumption: the AC's "existing tests pass unmodified" allows added cases.
- no — slice 4 rewrites `lockLedger`'s first doc sentence, because invites becomes another user and the "list or
  income" wording was already stale for the connector's repeat check. Assumption: a why-comment update is part of the
  reuse.

## Follow-ups

- None found that an AC doesn't cover.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

## Revision 1

The skeptic returned APPROVE WITH EDITS. What changed:

- Contracts: the Zod issue is written out with all six fields as the Base sends it (`origin` was missing), and so is
  `badMonthReply`'s body.
- Slice 6 Tests: `incomeLimit.test` doesn't reach `income/limit.ts:48`. It's replaced by `categories.int` and
  `income.int` describe `over-income rule (brief 060)`, whose November plans run `checkIncome`'s read.
- Slice 1: every suite now gets a nested `describe('month checks')`, so the intro and the bullets agree (about +6
  lines). Issue tests compare the whole body; order tests compare only status and `error`.
- The local format check is spelled out: `yarn prettier --check . '!.claude/worktrees/**'`.
- A code span in slice 6's Checks that Prettier had broken is fixed.

No slice, contract or version change: still patch, 1.15.1 → 1.15.2.

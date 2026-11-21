# Share the API's month checks and month dates

Type: chore (behaviour-preserving, runs through `/kopiyka-hos-refactoring`)

## Why

The API routes repeat the same small month rules by hand:

- The `YYYY-MM` Zod check `z.string().regex(MONTH_RE, 'expected YYYY-MM')` is written 6 times in 5 route files
  (categories, expenses, income, balances, summary). Brief 090 left it as a refactoring candidate.
- The ended-month refusal `if (monthEnded(...)) return reply.code(409).send({ error: 'month_ended' })` is written
  11 times (categories 5, expenses 4, income 2), and the expense copies also cut the month out of a date with
  `.slice(0, 7)`.
- A month's first day is built as `` `${month}-01` `` in about 20 places across routes, `categories/monthLists.ts`
  and the Notion import.
- `lockLedger` lives in `categories/monthLists.ts`, so income and expenses import a categories module to lock a
  ledger, and `invites/routes.ts` writes the same `SELECT … FOR UPDATE` inline.

A reader has to check each copy to see it's the same rule, and a future change to the rule has to find every copy.

## What

Nothing a client, a test or the database can see changes. Only the code moves:

- **Month param**: one exported Zod piece for a `YYYY-MM` string (next to `MONTH_RE`, or a small shared params
  module), used by every route that takes a month. The error message stays `expected YYYY-MM`.
- **Ended month**: one helper that answers 409 `{ error: 'month_ended' }` for an ended month, used by every route
  that refuses one. It keeps each route's order of checks and its `now()` reading (a route that reads `now()` once
  and reuses it keeps doing that).
- **Month dates**: `monthOf(date)` (`YYYY-MM-DD` → `YYYY-MM`) and `monthStart(month)` (`YYYY-MM` → `YYYY-MM-01`) in
  `dates.ts`, used instead of the hand-written `.slice(0, 7)` on expense and income dates and `` `${month}-01` ``.
- **Ledger lock**: `lockLedger` moves to `ledgers/`, and every caller (categories, income, expenses, invites)
  imports it from there. Invites uses it instead of its inline query.

## Acceptance criteria

- [ ] `rg "regex\(MONTH_RE" apps/api/src` finds only the shared month piece.
- [ ] `rg "error: 'month_ended'" apps/api/src` finds only the shared helper (the income loader's `return 'month_ended'`
      result code may stay, as it isn't a reply).
- [ ] `rg '\$\{[a-zA-Z.]*month\}-01' apps/api/src` finds only `monthStart` in `dates.ts`; `monthOf` and `monthStart`
      have unit tests in `test/dates.test.ts`.
- [ ] `lockLedger` is exported from `ledgers/`; nothing imports it from `categories/monthLists.ts`, and
      `invites/routes.ts` has no inline `FOR UPDATE` on `ledgers`.
- [ ] Behaviour unchanged: existing tests pass unmodified (only import paths may change); status codes, response
      bodies, error codes, Zod messages and SQL effects are the same; integration tests ran against MySQL.

## Out of scope

- Bug fixes, new behaviour, changed error codes or messages.
- The shared SQL between routes and the Notion import (soft delete, live month row, upserts): its own refactor brief.
- The importer scripts' shared CLI code, the app, and the MCP connector: their own briefs.
- `apps/mcp`'s own copies of `dates.ts` and `money.ts` (separate on purpose).
- Splitting `categories/routes.ts` or `expenses/routes.ts` into a `service.ts`.

## Notes

- Version: `patch` (conventions §8b: a refactor of shipped code is never `none`).
- The integration suites `categories.int`, `expenses.int`, `income.int`, `invites.int`, `balances.int`,
  `summary.int` and `notionHistory.int` cover the touched routes; they need MySQL running locally.
- `expenses/routes.ts`' `MonthQuery` also has `categoryId`, and `summary/routes.ts` checks `from` and `to`, so the
  shared piece is the month field, not a whole params object.
- Found by the project scan in this session (2026-11-21), PR A of the refactor roadmap: A API month guards,
  C importer scripts, G small cleanups, B Notion/route shared SQL, then the app (data hooks, button actions, UI
  pieces).

# Plan: Show a month's start and end balance on the Budget tab

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/month-start-end
Base: origin/main (33d9544, version 1.8.0)

## Approach

A new read-only API domain, `apps/api/src/balances/routes.ts`, answers
`GET /api/ledgers/:id/months/:month/balance` from `month_balances` (migration 016). It returns `{ balance: … }`
or `{ balance: null }` with 200, and uses the same guards, `MONTH_RE` check and `ledger_not_found` 404 as
`income/routes.ts`. The import code stays in `notion/` because it writes the table. Here, reading it is its own
domain (conventions §2). Brief 086 can extend this domain later.
In the app, a small hook `data/useMonthBalance.ts` loads the month on focus. It is keyed by ledger and month, so
switching months shows nothing until the new month loads. It returns `null` while loading, for "none" and on an
error. A pure `balanceLine()` in `data/monthBalance.ts` turns the balance into `Start … → End …` with `eur`/`toCents`,
so the AC's app test can cover the text in Node. The Budget screen shows the line between the header and the
ScrollView, so it never waits on the month's categories or income. The demo store gets one route that answers
`{ balance: null }`.
Alternative considered: answer 404 `not_found` for a month without a row. Rejected because it collides with the
item/ledger 404s, which `api()` turns into `ApiError`/`onLedgerGone`, and it makes "none" an error path. It also
makes the demo route a refusal instead of a plain reply.

## Contracts

- DB: none. Reads `month_balances` from migration 016: `balance_month DATE`, `opening_eur DECIMAL(12,2)`,
  `closing_eur DECIMAL(12,2)`, PK `(ledger_id, balance_month)`. `db.ts` has `decimalNumbers: false`, so both
  columns arrive as signed decimal strings like `'-180.00'`.
- API: `GET /api/ledgers/:id/months/:month/balance`, `preHandler: [app.requireAuth, app.requireLedger]`
  - params: `month` must match `MONTH_RE` (`YYYY-MM`, month 01–12)
  - 200 `{ balance: { openingEur: '-180.00', closingEur: '-52.00' } }` when the ledger has a row for that month
  - 200 `{ balance: null }` when it has no row ("none")
  - errors: 400 `invalid_request` for a malformed month (Zod, through the global handler); 401 for no session
    (`requireAuth`); 404 `ledger_not_found` for a non-member (`requireLedger`)
  - SQL: `SELECT opening_eur, closing_eur FROM month_balances WHERE ledger_id = ? AND balance_month = ?` with
    `[req.ledger!.ledgerId, \`${month}-01\`]`
  - DTO, in `balances/routes.ts`: `interface MonthBalanceDto { openingEur: string; closingEur: string }`. Both are
    signed decimal strings as stored.
  - Consumers: the app's `useMonthBalance` and the demo store. Read-scope API tokens (the MCP connector) can also GET
    it, because `apiTokens/auth.ts` lets them read every GET route, but no tool calls it (out of scope).
- App:
  - `apps/mobile/src/api/types.ts`: `export interface MonthBalance { openingEur: string; closingEur: string }`, with a
    JSDoc saying both are signed decimal strings (`'-180.00'`) and the month runs from opening to closing.
  - `apps/mobile/src/data/monthBalance.ts`: `export function balanceLine(balance: MonthBalance | null): string | null`
    returns `` `Start ${eur(toCents(openingEur))} → End ${eur(toCents(closingEur))}` ``, or `null` for `null`.
  - `apps/mobile/src/data/useMonthBalance.ts`:
    `export function useMonthBalance(ledgerId: number, month: string): MonthBalance | null`
    - `useFocusEffect` + `api<{ balance: MonthBalance | null }>(…)` with the `let live` guard
    - state tagged `${ledgerId}/${month}`, like `useIncome`
    - a rejection is caught and leaves the line out, with a comment explaining why (brief: the line never blocks; no
      retry). `client.ts` still handles 401 and `ledger_not_found` globally.
    - a failed refetch on focus for the same ledger and month keeps the line already shown, as `useIncome` does.
  - `apps/mobile/src/demo/balanceRoutes.ts`: `balanceRoutes: Route[]` with one `GET`
    `/^\/api\/ledgers\/\d+\/months\/\d{4}-\d{2}\/balance$/` (no capture group: the answer needs no params) → `{ balance: null }`, registered in `demo/store.ts`.
  - Screen: `app/(tabs)/budget.tsx` renders `{line ? <Text style={styles.balance}>{line}</Text> : null}` under the
    header.
- Reuses:
  - API: `MONTH_RE` (`dates.ts`), `app.requireAuth`/`app.requireLedger`, and the test helpers `makeUser`, `authHeader`,
    `clearData` (which already clears `month_balances`) from `test/helpers.ts`, and `addMember` from
    `src/ledgers/members.ts`.
  - App: `eur` and `toCents` from `@/format`. `toCents('-180.00')` is `-18000` and `eur(-18000)` is `'−€180'` with
    U+2212, the same minus the brief uses (checked with `tsx` on Base).
  - Demo: the `Route` type and `fixtureStore` (`test/demoFixture.ts`).
- New dependencies: none.

## Version

Bump: minor, 1.8.0 → 1.9.0
Why: this is the §8b `minor` row (a new API route and a new read-only line on the Budget tab), and everything that
exists keeps working. Shipped app builds don't call the route. On a rollback, the previous API answers the new app's
request with 404 `not_found`, which the hook treats as an error and leaves the line out. There is no migration.

## Slices

- [x] 0. Bump version to 1.9.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.9.0
- [x] 1. Add a read-only route for a month's opening and closing balance
  - Files: apps/api/src/balances/routes.ts (new), apps/api/src/app.ts (import + `await balanceRoutes(app, deps)`),
    apps/api/test/balances.int.test.ts (new)
  - Change: the route and DTO from Contracts. Its local `MonthParams` Zod schema copies `income/routes.ts` line 20.
  - Tests: `balances.int.test.ts`, `describe.skipIf(!(await testDbReachable()))`, fixed clock, rows stored with raw
    SQL like `income.int.test.ts`'s `storeItem`:
    - "answers the month's opening and closing as signed decimal strings": the owner's ledger has 2026-02
      `-180.00`/`-52.00` → 200 `{ balance: { openingEur: '-180.00', closingEur: '-52.00' } }`. Also 2026-01
      `0.00`/`-180.00` → `'0.00'`/`'-180.00'`.
    - "lets any member read it": the same row read by an added member (`addMember`) → same body
    - "answers none for a month without a row": 2026-11 → `{ balance: null }`
    - "never shows another ledger's balance": only a stranger's ledger has a 2026-02 row → `{ balance: null }`
    - "rejects a malformed month": `2026-13`, `2026-1`, `abc` → 400 `invalid_request`
    - "needs a session": no headers → 401
    - "answers 404 for someone else's ledger": → 404 `ledger_not_found`
  - ~110 lines
- [ ] 2. Answer the balance route in the demo with none
  - Files: apps/mobile/src/api/types.ts (`MonthBalance`), apps/mobile/src/demo/balanceRoutes.ts (new),
    apps/mobile/src/demo/store.ts (spread `...balanceRoutes`), apps/mobile/test/demoBalance.test.ts (new),
    apps/mobile/demo-modules.txt (via `yarn mobile export:web` + `yarn mobile check-builds --accept`; expected diff is
    `+src/demo/balanceRoutes.ts`)
  - Change: the demo store answers every month with `{ balance: null }`, so the demo never invents balances
  - Tests: `demoBalance.test.ts` → "answers none for a past and the current month": `fixtureStore()` GET
    `/api/ledgers/1/months/2026-10/balance` and `…/2026-11/balance` each resolve to `{ balance: null }`
  - ~45 lines
- [ ] 3. Show the month's start and end balance on the Budget tab
  - Files:
    - apps/mobile/src/data/monthBalance.ts (new)
    - apps/mobile/src/data/useMonthBalance.ts (new)
    - apps/mobile/src/app/(tabs)/budget.tsx: call the hook, render the line between the header `View` and the
      `ScrollView`, add a `balance` style (centred, `fonts.body` 13, `colors.muted`, `tabular-nums`) in `makeStyles`
    - apps/mobile/test/monthBalance.test.ts (new)
    - apps/mobile/demo-modules.txt (`--accept`; expected `+src/data/monthBalance.ts`, `+src/data/useMonthBalance.ts`)
  - Change: the line sits under the month switcher for a month with a row. Nothing shows while it loads, for none, or
    on an error.
  - Tests: `monthBalance.test.ts`, a `balanceLine` table:
    - `{ '-180.00', '-52.00' }` → `'Start −€180 → End −€52'`
    - `{ '0.00', '-180.00' }` → `'Start €0 → End −€180'` (January on the laptop)
    - `{ '0.00', '-35.00' }` → `'Start €0 → End −€35'` (October)
    - `{ '1234.50', '-0.50' }` → `'Start €1,234.50 → End −€0.50'` (cents, a thousands separator, minus under €1)
    - `null` → `null` (none, and the hook's error and loading results)
    - every expected string uses U+2212
  - Verify: browser checks (AC4/AC2 rows below), then typecheck and lint.
  - ~85 lines

Total ≈ 240 changed lines, not counting slice 0.

## AC → evidence

| AC                                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 API: `{ opening, closing }` as `-180.00`/`-52.00` strings, none, 404, 401, 400 | `balances.int.test.ts`: "answers the month's opening and closing as signed decimal strings", "lets any member read it", "answers none for a month without a row", "never shows another ledger's balance", "answers 404 for someone else's ledger", "needs a session", "rejects a malformed month"                                                                                                                                                                |
| AC2 App: renders the line for a month with balances; nothing for none or an error  | `monthBalance.test.ts` (`balanceLine` table, incl. `null` → `null`). Error path, manual (web): in the in-app browser, block `*/balance` (DevTools → Network request blocking) and reload Budget on February → no line, categories and income figures as before. Fallback, which also covers rollback: point the web build at an API started from Base 33d9544, which has no route and answers 404 `not_found` → no line on any month, the rest of the tab works. |
| AC3 Demo answers none; demo Budget tab renders                                     | `demoBalance.test.ts` "answers none for a past and the current month". Manual: `yarn mobile web` with `KOPIYKA_FLAVOUR=demo`, Budget tab → no line and no `The demo store has no route` in the console.                                                                                                                                                                                                                                                          |
| AC4 Browser at ~390×844, web, laptop ledger 1                                      | Launch configs `api` + `web`, phone width. January → `Start €0 → End −€180`, February → `Start −€180 → End −€52`, October → `Start €0 → End −€35`, November → no line and no gap. Switch months with the switcher and check the line updates. Light and dark mode. Screenshots in the PR. Laptop rows checked read-only on 2026-11-21: Jan `0.00`/`-180.00`, Feb `-180.00`/`-52.00`, Oct `0.00`/`-35.00`, nothing for Nov.                                       |
| AC5 Gates green                                                                    | `yarn format:check && yarn lint && yarn typecheck && yarn test` per slice. Plus `yarn mobile export:web` + `yarn mobile check-builds` in slices 2–3.                                                                                                                                                                                                                                                                                                             |

## Not doing (YAGNI)

- No write route, and no balance on Home, Statistics or in the MCP connector (no new tool). No computed balance for
  November on (brief: out of scope).
- No retry button or error text for the line: the brief says a failure leaves it out.
- No separate VoiceOver label. The line is plain read-only text, and VoiceOver reads it as written.
- No shared `MonthParams` schema across `categories`/`expenses`/`income`/`balances`. That would be a cross-domain
  refactor this brief doesn't need (Follow-ups).
- No edit to migration 016's "Nothing in the app reads it yet" comment: migrations aren't edited after merge.
- No sample balances in the demo data (brief: no invented balances).

## Risks

- The worktree has no `node_modules` yet. The developer runs `yarn install` from the lockfile first. That adds no new
  versions, so the 24h age gate doesn't apply. Disproved before slice 0.
- The API integration tests skip silently in a worktree unless `DATABASE_URL_TEST` is exported from the main
  checkout's `.env`. Slice 1 must show its cases ran, not skipped, in the Vitest output.
- `month_balances.balance_month` is DATE with `dateStrings: ['DATE']`, so the `= '2026-02-01'` comparison matches.
  Slice 1's happy-path test proves it.
- The line between the header and the ScrollView might crowd the header on a small phone. Slice 3's browser check at
  390×844 shows it. If it looks wrong, move it to the top of the ScrollView content and record that under Deviations.

## Open questions

- Decided (user, 2026-11-21): `eur` as it is, without `.00` for whole euros, so the AC texts read
  `Start −€180 → End −€52` and `Start €0 → End −€180`.
- Blocking: no. The brief writes the reply as `{ opening, closing }`. The plan names the fields `openingEur`/
  `closingEur`, as every other money DTO does (`amountEur`, `plannedEur`), and wraps them as
  `{ balance: … | null }` so "none" is a plain 200. Assumed: fine.
- Blocking: no. Wording `Start → End`, as the brief assumed.

## Follow-ups

- Brief number clash (resolved): renumbered 089 → 090 because the main checkout has `docs/features/089-period-statistics/` besides this
  `090-month-start-end`. One of them needs a new number before both land.
- Laptop data: July and August both hold `0.00 → -377.00`, and August's opening isn't July's closing. This is from
  brief 085's import and fill rule, so worth a look in Notion. It doesn't affect this brief.
- `MonthParams`/`Month` Zod schemas are now repeated in four route files (categories, expenses, income, balances).
  They could be one export next to `MONTH_RE`, as a `/kopiyka-hos-refactoring` candidate.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

## Revision 1

Skeptic verdict APPROVE WITH EDITS:

- Contracts › Reuses names where each test helper comes from: `addMember` is in `src/ledgers/members.ts`, not `test/helpers.ts`.
- The hook keeps the line already shown when a refetch on focus fails for the same month, as `useIncome` does.
- The demo route pattern drops its unused capture group.
- AC2's error check adds a fallback that also covers rollback: run against an API from Base, which answers 404 `not_found`.

What ships is unchanged, so the version stays minor, 1.8.0 → 1.9.0. Folder renamed 089 → 090 by the coordinator.

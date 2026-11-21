# Plan: See a period's totals in Statistics

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR A `feat/period-statistics` (this worktree); PR B `feat/period-statistics-screen`
Base: PR A origin/main (5df77d3, version 1.10.0); PR B origin/main once PR A is merged

## Approach

The whole brief comes to about 935 changed lines, so it ships as the two sequential PRs the brief suggests.
**Recommended.** PR A is the endpoint (~385 lines) and PR B is the screen (~550 lines). Each one can ship alone: PR A
adds a route no client calls yet, and PR B replaces the placeholder tab.

- **PR A.** A new read-only API domain, `apps/api/src/summary/routes.ts`, answers
  `GET /api/ledgers/:id/summary?from&to`. It runs three grouped queries, using the same filters the month endpoints
  use:
  - planned per (category, month) from the month's list joined to `category_budgets`;
  - spent per (category, month) from live expenses;
  - income per month.
    It then adds the rows up in bigint cents. Totals, months and categories all come from the same rows, so they add up
    by construction.
- **PR B.** A pure `data/period.ts` works out `from`/`to` for each choice and the label. A `useSummary` hook follows
  `useIncome`'s shape. `app/(tabs)/statistics.tsx` puts these together with the existing `Pressable`, `LoadError`,
  `EmptyMonth` and `MonthSwitcher`.
- **Demo.** The demo has no Statistics tab (`demo/tabItems.ts`; `statistics.tsx` and the text "Statistics" are
  banned in `scripts/buildCheck.mts`). No demo screen reaches the route, so the demo store gets no route and
  `demo-modules.txt` doesn't change. Brief 090 is different: its route was called by the Budget tab, which the demo
  has.

Alternative considered: no new route. The app would call the three month endpoints once per month, up to 72 requests
for 24 months, and add them up on the client. It lost because the brief asks for one server-side endpoint (and 086
builds on it), the per-IP API limits (brief 067) make 72 calls risky, and it would repeat the month rules client-side.
Second alternative: one PR of ~935 lines. It lost because it is more than twice the ~400 target and the brief asks for the split.

## Contracts

- DB: none. Reads:
  - `category_months` (PK `(category_id, list_month)`, `deleted_at`);
  - `category_budgets` (PK `(category_id, budget_month)`);
  - `expenses` (`INDEX (category_id, expense_date)`, `deleted_at`);
  - `income_items` (`INDEX (ledger_id, income_month)`);
  - `categories` (`deleted_at`).

  `db.ts` has `decimalNumbers: false`, so `SUM(...)` and `COALESCE(b.planned_eur, 0)` arrive as decimal strings.

- API: `GET /api/ledgers/:id/summary?from=YYYY-MM&to=YYYY-MM`, `preHandler: [app.requireAuth, app.requireLedger]`
  - query (Zod): `from` and `to` each match `MONTH_RE`. Refined with `from <= to`, then with `monthSpan(from, to) <= 24`,
    where `monthSpan` counts both ends: `(ty*12+tm) − (fy*12+fm) + 1`. It is computed, not enumerated, so
    `0001-01…9999-12` stays cheap.
  - 200 (fields added by slice: `totals` A1, `months` A2, `categories` A3):
    ```ts
    interface SummaryTotalsDto {
      incomeEur: string;
      plannedEur: string;
      spentEur: string;
      leftEur: string;
    }
    interface SummaryMonthDto {
      month: string;
      incomeEur: string;
      spentEur: string;
      leftEur: string;
    }
    interface SummaryCategoryDto {
      categoryId: number;
      name: string;
      plannedEur: string;
      spentEur: string;
    }
    interface PeriodSummaryDto {
      totals: SummaryTotalsDto;
      months: SummaryMonthDto[];
      categories: SummaryCategoryDto[];
    }
    ```
    - Amounts are decimal strings made with `centsToString`. `leftEur = income − spent` is signed (`'-12.50'`).
    - `months` holds every month `from…to`, oldest first, with `'0.00'` where a month has nothing. A one-month period
      gives one row.
    - `categories` holds every live category listed in at least one month of the period, plus any category with live
      spending there. It is sorted by spent (largest first), then `sort_order`, then `category_id`. `name` is
      `NAME_IN_MONTH` at `${to}-01`, which is the category's name as of the period's last month.
  - SQL (parameterised; `first = ${from}-01`, `last = ${to}-01`, `end = nextMonthStart(to)`):
    - planned: `category_months m JOIN categories c ON c.category_id = m.category_id LEFT JOIN category_budgets b ON b.category_id = m.category_id AND
b.budget_month = m.list_month WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND
m.list_month BETWEEN ? AND ?`. It selects `m.category_id`, `DATE_FORMAT(m.list_month, '%Y-%m') AS month` and
      `COALESCE(b.planned_eur, 0)`. This matches `GET /categories?month`: a plan counts only while its category is in
      that month's list.
    - spent: `expenses e JOIN categories c ON c.category_id = e.category_id WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND e.deleted_at IS NULL AND
e.expense_date >= ? AND e.expense_date < ? GROUP BY e.category_id, month`, with `SUM(e.amount_eur)`. This matches
      `GET /expenses?month`.
    - income: `income_items WHERE ledger_id = ? AND income_month BETWEEN ? AND ? GROUP BY month`, with
      `SUM(amount_eur)`. This matches `GET /months/:month/income`.
    - names (A3): `SELECT c.category_id, ${NAME_IN_MONTH} AS name, c.sort_order FROM categories c WHERE c.ledger_id = ?
AND c.deleted_at IS NULL`, with `[last, ledgerId]`.
  - errors: 400 `invalid_request` for a missing or malformed month, `from` after `to`, or more than 24 months (Zod,
    through the global handler); 401 with no session; 404 `ledger_not_found` for a non-member.
  - Consumers: PR B's `useSummary`. Read-scope API tokens can also GET it (`apiTokens/auth.ts` allows every GET), but
    no MCP tool calls it (out of scope).
- App (PR B):
  - `apps/mobile/src/api/types.ts` mirrors the DTOs: `PeriodSummary`, `SummaryTotals`, `SummaryMonth` and
    `SummaryCategory`, with the same fields and a JSDoc on signed `leftEur`. The JSDoc never names the tab (the
    word "Statistics" is banned from the demo bundle, and `types.ts` reaches it).
  - `apps/mobile/src/data/period.ts`:
    - `export type PeriodChoice = 'current' | 'previous' | 'last3' | 'last6' | 'last12' | 'thisYear' | 'custom'`
    - `export interface Period { from: string; to: string }`, both `'YYYY-MM'`
    - `export const PERIOD_CHOICES: readonly { choice: PeriodChoice; label: string }[]`, in the brief's order. Labels:
      'Current month', 'Previous month', 'Last 3 months', 'Last 6 months', 'Last 12 months', 'This year', 'Custom'.
    - `export function presetPeriod(choice: Exclude<PeriodChoice, 'custom'>, now: Date): Period` works from
      `kyivMonth(now)` and `shiftMonth`: current `m…m`, previous `m−1…m−1`, lastN `m−(N−1)…m`, thisYear `YYYY-01…m`.
    - `export function moveCustom(period: Period, end: 'from' | 'to', month: string): Period` sets one end and pulls
      the other end along, so that `from ≤ to` and the period spans at most 24 months. An illegal custom range can't
      be built.
    - `export function periodLabel(period: Period): string`:
      - one month → `monthLabel` ('November 2026');
      - same year → `'Sep – Nov 2026'`;
      - across years → `'Dec 2025 – Nov 2026'` (en-US short months, en dash with spaces).
  - `apps/mobile/src/data/periodSummary.ts`:
    - `export function planGap(category: SummaryCategory): { text: string; over: boolean }`. It gives `'€20 over'`,
      `'€30 under'` or `'On plan'`, worked out from `spent − planned` in cents.
    - `export function isEmptySummary(s: PeriodSummary): boolean`: no categories and income `'0.00'` (no categories
      means nothing planned or spent).
  - `apps/mobile/src/data/useSummary.ts`:
    `export function useSummary(ledgerId: number, period: Period): { summary: PeriodSummary | null; error: boolean;
reload: () => void }`. It is `useIncome`'s shape: state tagged `${ledgerId}/${from}/${to}`, `useFocusEffect`, the
    `live` guard, and a failed refetch keeps the data and sets `error`. A new period reads as loading and refetches.
  - Screen `app/(tabs)/statistics.tsx`, from top to bottom:
    - the chip row, wrapping;
    - for Custom, From and To `MonthSwitcher`s;
    - the `periodLabel` line;
    - a totals card with Income, Planned, Spent and Left. Left uses `colors.danger` when `leftEur` is negative;
    - "By category" rows: name, planned and spent, and the `planGap` text in `colors.over` when over;
    - "By month" rows, only when `months.length > 1`: `shortMonthLabel`, income, spent and left (red when negative).
    - Loading shows `ActivityIndicator`, an error shows `LoadError` + Retry, empty shows `EmptyMonth`.
- Reuses:
  - API: `MONTH_RE`, `nextMonthStart` (`dates.ts`); `toCents`, `centsToString` (`money.ts`); `NAME_IN_MONTH`
    (`categories/monthLists.ts`); `requireAuth`/`requireLedger`.
  - API tests: `makeUser`, `storeMonthList`, `authHeader`, `clearData` (`test/helpers.ts`) and `addMember`
    (`src/ledgers/members.ts`).
  - App: `kyivMonth`, `shiftMonth`, `monthLabel`, `shortMonthLabel`, `eur`, `toCents` (`@/format`); `Pressable`,
    `LoadError`, `EmptyMonth`, `MonthSwitcher`, and `DateChips`'s chip styling (copied, since it isn't exported);
    `useThemedStyles`/`useColors`.
- New dependencies: none.

## Version

PR A — Bump: minor — 1.10.0 → 1.11.0
Why: the §8b `minor` row: a new API route, and everything that exists keeps working. No migration, so rollback is
unaffected. Shipped app builds never call the route.

PR B — Bump: minor — 1.11.0 → 1.12.0 (or main's number + one minor, per §8b step 4)
Why: the §8b `minor` row: a new screen (Statistics stops being a placeholder). On rollback the previous app comes
back with it, and an app build left open against an older API gets 404 `not_found` and shows the tab's error state.

## Slices

### PR A — the endpoint (`feat/period-statistics`)

- [ ] A0. Bump version to 1.11.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.11.0
- [ ] A1. Add a read-only summary route with a period's totals
  - Files: apps/api/src/summary/routes.ts (new), apps/api/src/app.ts (import + `await summaryRoutes(app, deps)` after
    `balanceRoutes`), apps/api/test/summary.int.test.ts (new),
    docs/features/086-money-flow/brief.md (Status line: can build on 089's summary endpoint; the edit already in the
    worktree)
  - Change:
    - the Zod query with both refinements, and a local `monthSpan`;
    - the planned, spent and income queries;
    - a local `addRows` that sums cents into `totals`, with `leftEur`.
      The reply is `{ totals }`.
  - Tests: `summary.int.test.ts`, `describe.skipIf(!(await testDbReachable()))`. The clock is fixed at
    `2026-11-21T10:00:00Z` and `fetchRate` is stubbed. A November list comes from `storeMonthList(…, '2026-11', [])`,
    plans from raw `INSERT INTO category_budgets`, expenses from raw `INSERT INTO expenses (category_id, expense_date,
name, amount_eur, created_by)` as in `notion.int.test.ts`, and income from raw `INSERT INTO income_items` as in
    `income.int.test.ts`'s `storeItem`.
    - "matches one month's income, planned and spent as the month endpoints return them" (AC1). For 2026-10: rent
      planned 650.00 and groceries 300.50; expenses 12.50 + 40.05 + 100.00; income 1500.00 + 250.00. The test sums
      `GET /categories?month=2026-10` `plannedEur`, `GET /expenses?month=2026-10` `amountEur` and
      `GET /months/2026-10/income` `amountEur` in bigint cents, and expects `totals` to equal them: `'950.50'`,
      `'152.55'`, `'1750.00'`, `leftEur '1597.45'`.
    - "gives a negative left when more was spent than came in": income 100.00 and spent 112.50 → `leftEur '-12.50'`.
    - "counts the current month with its data so far": an expense dated 2026-11-21 counts in `from=to=2026-11`.
    - "lets any member read it": an added member gets the same body.
    - "rejects a bad month, from after to, or more than 24 months" (AC5). These answer 400 `invalid_request`:
      `from=2026-13`, `from=2026-1`, `from` missing, `from=2026-11&to=2026-10`, `from=2024-11&to=2026-11` (25 months).
      `from=2024-12&to=2026-11` (24 months) answers 200.
    - "needs a session": 401.
    - "answers 404 for someone else's ledger" (AC4, second half): the stranger asks for the owner's ledger → 404
      `ledger_not_found`, as `balances.int.test.ts` does.
  - ~195 lines (route ~80, tests ~115 including the one-time setup). This is over the ~150 target because of the
    shared setup. The rest of the file is reused by A2 and A3.
- [ ] A2. Add each month's income, spent and left to the summary
  - Files: apps/api/src/summary/routes.ts, apps/api/test/summary.int.test.ts
  - Change: lists the months `from…to` by stepping with `nextMonthStart`, and fills each from the same rows.
    Missing months get `'0.00'`.
  - Tests:
    - "a three-month summary's totals are the sums of its months" (AC2). Sep–Nov 2026 each get different plans,
      expenses and income, and August gets one expense, which must not count. Three `from=to` summaries give the
      expected values. The test checks that `totals` equals their sums, and that `months` (Sep, Oct, Nov, oldest
      first) sums to `totals.incomeEur`/`spentEur`, with each `leftEur = income − spent`.
    - "shows zeros for a month with no data": `from=2026-06&to=2026-08` with nothing in July → July
      `{ incomeEur: '0.00', spentEur: '0.00', leftEur: '0.00' }`.
    - "never counts another ledger's data" (AC4, first half): the stranger's ledger has its own plans, expenses and
      income in the same months, and the owner's totals and months are unchanged.
  - ~75 lines
- [ ] A3. Add each category's planned and spent to the summary
  - Files: apps/api/src/summary/routes.ts, apps/api/test/summary.int.test.ts
  - Change: the names query, and a per-category fold of the planned and spent rows, sorted as in Contracts.
  - Tests:
    - "its categories add up to the totals" (AC2): on the A2 data, the category planned and spent sums equal
      `totals.plannedEur`/`spentEur`. Order is by spent, and ties fall back to `sort_order`.
    - "names a category as in the period's last month": groceries renamed 'food' in Nov's row → `name: 'food'` for
      Sep–Nov and `'groceries'` for Sep–Oct.
    - "leaves out a deleted category, its plan and expenses, and a deleted expense" (AC3), with November open:
      - `DELETE /categories/:fun/months/2026-11` → fun's Nov plan and Nov expenses drop out of the totals, its Nov
        month and its category row. Its October figures stay.
      - `categories.deleted_at` set on `gym` (pre-028 delete, raw SQL) → gym isn't in `categories` and its plan and
        expenses aren't counted.
      - `DELETE /expenses/:id` on one rent expense → not in spent.
      - Each one is checked against totals, months and categories.
  - ~115 lines

PR A total ≈ 385 changed lines, not counting A0.

### PR B — the screen (`feat/period-statistics-screen`, from main after PR A)

- [ ] B0. Bump version to 1.12.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.12.0 (main's number plus one minor, if main has moved)
- [ ] B1. Work out each Statistics period's months
  - Files: apps/mobile/src/data/period.ts (new), apps/mobile/test/period.test.ts (new)
  - Change: `PeriodChoice`, `Period`, `PERIOD_CHOICES`, `presetPeriod`, `moveCustom`, `periodLabel` as in Contracts.
  - Tests: `period.test.ts`, `it.each` tables with expected values checked with `tsx` on Base, 2026-11-21:
    - `presetPeriod` at `2026-11-21T10:00:00Z`: current `2026-11…2026-11`, previous `2026-10…2026-10`, last3
      `2026-09…2026-11`, last6 `2026-06…2026-11`, thisYear `2026-01…2026-11`, last12 `2025-12…2026-11`.
    - January at `2027-01-15T10:00:00Z`: previous `2026-12…2026-12`, thisYear `2027-01…2027-01`, last3
      `2026-11…2027-01`, last12 `2026-02…2027-01`.
    - Kyiv midnight (UTC+2 after the 25 Oct DST change):
      - `2026-10-31T21:59:59Z` → current `2026-10`, previous `2026-09`;
      - `2026-10-31T22:00:00Z` → current `2026-11`, previous `2026-10`;
      - New Year: `2026-12-31T21:59:59Z` → thisYear `2026-01…2026-12`, and `2026-12-31T22:00:00Z` → thisYear
        `2027-01…2027-01`, previous `2026-12`.
    - `moveCustom`:
      - `{2026-09, 2026-11}`, from → 2026-10 gives `{2026-10, 2026-11}`;
      - from → 2026-12 gives `{2026-12, 2026-12}` (to follows);
      - to → 2026-08 gives `{2026-08, 2026-08}` (from follows);
      - from → 2024-11 on `{…, 2026-11}` gives `{2024-11, 2026-10}` (24 months);
      - to → 2028-01 on `{2026-01, …}` gives `{2026-02, 2028-01}`.
    - `periodLabel`: `{2026-11, 2026-11}` → 'November 2026'; `{2026-09, 2026-11}` → 'Sep – Nov 2026';
      `{2025-12, 2026-11}` → 'Dec 2025 – Nov 2026'.
  - ~150 lines
- [ ] B2. Load a period's summary for the open ledger
  - Files: apps/mobile/src/api/types.ts, apps/mobile/src/data/useSummary.ts (new), apps/mobile/src/data/periodSummary.ts
    (new), apps/mobile/test/periodSummary.test.ts (new)
  - Change: the DTO mirrors, the hook, `planGap` and `isEmptySummary`, as in Contracts.
  - Tests: `periodSummary.test.ts`:
    - `planGap`: planned 100.00 and spent 120.00 → `{ '€20 over', over: true }`; 100.00 / 70.00 → `'€30 under'`;
      100.00 / 100.00 → `'On plan'`; 0.00 / 12.50 → `'€12.50 over'`.
    - `isEmptySummary`: no categories with income 0 → true; no categories with income 1750.00 → false; a category
      with zeros → false.
    - The hook is checked by typecheck and lint here, and in the browser in B3.
  - ~95 lines
- [ ] B3. Show a period's totals on the Statistics tab
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx (replaces the placeholder)
  - Change:
    - the header;
    - the chip row for the six presets: `Pressable`, `accessibilityRole="button"`, `accessibilityState.selected`,
      ≥ 44pt, styled like `DateChips`;
    - the `periodLabel` line;
    - the totals card with Left red when negative;
    - loading (`ActivityIndicator`), and these texts:
      - empty: `EmptyMonth text="Nothing planned, spent or earned in this period."`;
      - first-load error: `LoadError message="Couldn’t load these figures. Check your connection and try again."
onRetry={reload}`;
      - error over kept data: Income's `"Couldn’t refresh. Check your connection and try again."` with Retry.
        The `period` is worked out on each render from `choice` and a `useState(() => new Date())` clock, as Income keeps
        `thisMonth`. Styles go in `makeStyles`.
  - Verify: web at ~390×844 (rows AC7, AC8).
  - ~150 lines
- [ ] B4. Pick a custom from and to month
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - a Custom chip. Choosing it starts the custom period from the period now on screen;
    - From and To `MonthSwitcher`s, stacked, each with a caption. Changes go through `moveCustom`.
  - Verify: web: from after to pulls to along; 25 months can't be built; the figures reload on each change. Also
    note whether the two switchers' identical "Previous month"/"Next month" labels read confusingly to a screen
    reader. If they do, record it under Deviations; no new prop is planned.
  - ~45 lines
- [ ] B5. Show a period by category and by month
  - Files: apps/mobile/src/app/(tabs)/statistics.tsx
  - Change:
    - a "By category" card: one row per category with its planned, spent and `planGap` text, one screen-reader stop
      each ('rent, spent €700 of €650 planned, €50 over');
    - a "By month" card, only when `months.length > 1`: one row per month with income, spent and left (red when
      negative).
  - Verify: web (AC7, AC8 rows).
  - ~110 lines

PR B total ≈ 550 changed lines, not counting B0. That is over the ~400 target. Its slices are each ≤ ~150, and every
part of it is in the brief's What. The skeptic may prefer a third PR (B5 alone, with its own minor bump). That PR
would ship the by-category and by-month cards on their own.

## AC → evidence

| AC                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 one month matches the month endpoints                                    | A1 `summary.int.test.ts` "matches one month's income, planned and spent as the month endpoints return them"                                                                                                                                                                                                                                                                                              |
| AC2 three months = sums; categories and months add up                        | A2 "a three-month summary's totals are the sums of its months"; A3 "its categories add up to the totals"                                                                                                                                                                                                                                                                                                 |
| AC3 deleted category plan + expenses, deleted expense not counted            | A3 "leaves out a deleted category, its plan and expenses, and a deleted expense" (month removal, pre-028 `deleted_at`, single expense; totals, months and categories)                                                                                                                                                                                                                                    |
| AC4 another ledger never counted; non-member same refusal                    | A2 "never counts another ledger's data"; A1 "answers 404 for someone else's ledger" (`ledger_not_found`, as other ledger routes)                                                                                                                                                                                                                                                                         |
| AC5 400 bad month / from > to / > 24 months                                  | A1 "rejects a bad month, from after to, or more than 24 months" (incl. 24 → 200)                                                                                                                                                                                                                                                                                                                         |
| AC6 app: each choice's from/to for a fixed date, January, Kyiv midnight      | B1 `period.test.ts` (`presetPeriod` tables for 2026-11-21, 2027-01-15, 2026-10-31 21:59:59Z / 22:00Z, 2026-12-31 21:59:59Z / 22:00Z)                                                                                                                                                                                                                                                                     |
| AC7 switching reloads; left red when negative; one month shows no month rows | Web at ~390×844 (launch configs `api` + `web`, QA ledger): tap each chip and watch the label and figures change with a GET `/summary?from&to` per switch in the network log; a QA month with spent > income shows Left in red (light and dark); Current month and Previous month show no "By month" card, Last 3 months shows 3 rows oldest first. `isEmptySummary`/`planGap` in `periodSummary.test.ts` |
| AC8 iPhone + web: Current month = Home; This year shows Jan–Oct income       | Web (developer, QA ledger, its own data): Current month's Income, Planned and Spent equal Home's cards. iPhone + web on ledger 1 (user): the same check, plus This year's By month rows show Jan–Oct income. Recorded in PR B's test plan                                                                                                                                                                |
| AC9 gates green                                                              | `yarn format:check && yarn lint && yarn typecheck && yarn test` per slice; PR B also runs `yarn mobile export:web` + `yarn mobile check-builds` with no `demo-modules.txt` change                                                                                                                                                                                                                        |

## Not doing (YAGNI)

- No demo store route: the demo has no Statistics tab, and the build check bans `statistics.tsx` from it. If a later
  brief adds Statistics to the demo, that brief adds the route.
- No planned figure per month in `months`: the screen shows income, spent and left only, and planned adds up through
  `categories`. Brief 086 can add it as an optional field.
- No `leftEur` or over/under on category rows from the server. `planGap` is presentation, and the server sends the
  facts.
- No future-month cap on Custom. The brief only asks for from ≤ to and ≤ 24 months, and a future month with plans is
  real data.
- Out of scope per the brief: charts and money flow (086), opening/closing balances (085/090), day ranges, per-member
  figures, comparisons, forecasts, remembering the period, drill-down, an MCP tool.
- No shared `Month` Zod schema across domains (existing Follow-up from 090).

## Risks

- A worktree's API integration tests skip silently unless `DATABASE_URL_TEST` is exported from the main checkout's
  `.env`. A1 must show its cases ran, not skipped.
- `GROUP BY` on the `DATE_FORMAT` alias under `ONLY_FULL_GROUP_BY`: MySQL allows grouping by a select alias. A1's
  happy path proves it.
- `SUM(DECIMAL(12,2))` arrives as a string with 2 decimals, and `COALESCE(b.planned_eur, 0)` as `'0.00'`
  (`categories/routes.ts` already relies on that). A1 asserts exact strings.
- `MonthSwitcher`'s eyebrow reads "BUDGET ’26" in the From/To fields. B4's browser check shows whether it reads oddly.
  If it does, it goes under Deviations, and the fix (an eyebrow prop) would be a separate question. It isn't planned.
- Seven chips plus Custom's two switchers may crowd 390 px. B3/B4 check at 390×844. Wrap is the fallback, and no
  horizontal scroll is planned.
- Signing in as `dimuch` needs the user's authenticator, so the developer's AC8 check runs on a QA ledger with its
  own data, and the user checks ledger 1 on iPhone and web. 088's January–October income is already imported on the
  laptop (ledger 1) and in production (2026-11-21), so that check needs no wait.

## Open questions

- Blocking: no. "Sept – Nov 2026" in the brief versus en-US 'Sep' everywhere else in the app (`shortDate`'s comment
  avoids 'Sept'). Assumed 'Sep – Nov 2026'.
- Blocking: no. Categories listed in the period with nothing planned or spent (e.g. 15 defaults at €0) are shown, as
  "each category". The alternative is to hide rows with €0 planned and €0 spent. Assumed shown.
- Blocking: no. A category's name over a period with renames: assumed its name in the period's last month
  (`NAME_IN_MONTH` at `to`).
- Blocking: no. Custom starts from the period on screen when chosen, and its ends drag each other to stay legal
  (no error text). Assumed fine.
- Blocking: no. Two PRs (recommended) versus one. PR B is ~550 lines, above the ~400 target; a third PR for B5 is the
  alternative.

## Follow-ups

- None yet.

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a>

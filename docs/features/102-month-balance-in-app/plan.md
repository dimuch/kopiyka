# Plan: Work out each month's start and end balance in the app

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/month-balance (PR 1); later PRs below each get their own branch
Base: origin/main (24e1200, version 1.16.1)

## Approach

The API works a month's balance out **on read**, in `balances/routes.ts`, with a pure walk in a new
`balances/carry.ts`. To answer month M it reads the ledger's imported rows and actual Ends up to M. It then finds the
latest such month before M, so the walk starts there, or at the ledger's first month at €0. It sums income − spent
for each month from there to M and carries the result forward. That's 5 queries at most, whatever the history length.
Income and spent come from the same two queries Statistics uses, moved into `summary/periodRows.ts`, so
`End − Start` of a computed month always equals Statistics' "left" for that month. Hand-set actual Ends go in a **new
table** `month_actual_ends`, which `import-balances` never touches. The response keeps its shape, and from PR 2 it
adds `actual: boolean`. The demo store walks the same way. The Budget line becomes a button that opens a small modal,
`/actual-end?month=`, to set or clear the actual End.

Alternatives considered:

- **Store the actual End in `month_balances`** with a `source` marker. Rejected for three reasons. A hand-set month
  has no stored Start, so `opening_eur` would need to be NULL, and the previous release would then answer
  `openingEur: null` to shipped apps (rollback lost: §8b major). `import-balances` upserts by (ledger, month), so a
  re-import would overwrite an actual End set on an imported month. And clearing one would lose the imported End.
- **Cache computed balances** in a table. Rejected: every expense, income, category-removal/restore and import path
  would have to invalidate it. The walk on read costs 5 indexed queries.

**Split (size):** about 1,300 changed lines in all, so the brief ships as four sequential PRs. Each one is shippable
alone and branches from `origin/main` after the previous one merges (if built earlier, it's stacked and says so on top):

| PR  | Branch                      | What ships                                                           | ≈ lines |
| --- | --------------------------- | -------------------------------------------------------------------- | ------- |
| 1   | `feat/month-balance`        | API computes Start/End from November on. The app shows it unchanged. | 390     |
| 2   | `feat/month-actual-end`     | Migration 018, the read honours actual Ends, PUT/DELETE routes       | 350     |
| 3   | `feat/month-balance-demo`   | The demo store computes, sets and clears like the API                | 175     |
| 4   | `feat/month-actual-end-app` | The app control: tap the line → set or clear the actual End          | 350     |

PR 1 alone meets the brief's "November shows a line" ACs on ledger 1, because shipped apps already render any
non-null balance.

## Contracts

- DB (PR 2): `migrations/018_month_actual_ends.sql`

  ```sql
  -- Brief 102. A month's actual End, set by hand on the Budget tab like Notion's Actual Closing. While a month has a
  -- row, its line ends at it and the next month starts from it; clearing deletes the row. Kept apart from
  -- month_balances, which brief 085's import-balances rewrites, so a re-import never touches a hand-set End.
  CREATE TABLE IF NOT EXISTS month_actual_ends (
    ledger_id      INT UNSIGNED  NOT NULL,
    balance_month  DATE          NOT NULL,   -- always day 1: 2026-11-01
    closing_eur    DECIMAL(12,2) NOT NULL,   -- signed: negative = money short
    PRIMARY KEY (ledger_id, balance_month),
    CONSTRAINT fk_month_actual_ends_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
  );
  ```

  Additive. The previous release runs on it and ignores the table (it shows computed Ends until it's rolled forward).
  `test/helpers.ts` `DATA_TABLES` gains `'month_actual_ends'`.

- **The rule** (pure, `apps/api/src/balances/carry.ts`; cents are `bigint`):
  - _Current month_ = `monthOf(kyivToday(now()))`. Expense dates and `income_month` are already Kyiv calendar
    dates, so a month's rows are `expense_date` in `[YYYY-MM-01, LAST_DAY]` and `income_month = YYYY-MM-01`. There is
    no time-zone maths. December starts at 00:00 Kyiv on 1 December.
  - _First month_ = the earlier of the ledger's first budgeted month and its first imported month.
    - First budgeted: `MIN(m.list_month)` over live rows of live categories, the same predicate as `hasBudget`.
    - The imported month is included so that every stored row still shows (AC2). See Open questions.
  - A month has a balance only when `first month ≤ M ≤ current month`. Otherwise `null`. A ledger with no budget
    and no import has none.
  - Start(M):
    - an imported row: its stored `opening_eur`;
    - otherwise the previous month's End, or €0 when M is the first month.
  - End(M): its actual End if set (PR 2), otherwise its stored `closing_eur`, otherwise Start + income − spent.
    - Income is every `income_items` row of the month.
    - Spent is live expenses (`e.deleted_at IS NULL`) of live categories (`c.deleted_at IS NULL`) dated in the month.
      That is Statistics' definition, `spentRows`.
  - `walkStart(month, firstMonth, known) → { from: 'YYYY-MM'; openingCents }`:
    - With an imported or actual month P where `first ≤ P < M`, it starts after the latest such P: `from` = P + 1,
      `openingCents` = P's End.
    - With none, `from` = first month and `openingCents` = 0n.
  - `carryBalance(month, start, known, flows: ReadonlyMap<'YYYY-MM', bigint>) → { openingCents; closingCents;
actual: boolean }`. `actual` arrives in PR 2. A month missing from `flows` has a flow of 0n.
  - `KnownMonths = { stored: ReadonlyMap<'YYYY-MM', { openingCents; closingCents }>; actual: ReadonlyMap<'YYYY-MM',
bigint> }` (`actual` from PR 2).
  - Queries per read: (1) first budgeted month, (2) `month_balances` rows `≤ M`, (3) `month_actual_ends` rows `≤ M`
    (PR 2), (4) `incomeRows(from, M)`, (5) `spentRows(from, M)`. There's no transaction: a write landing between them
    is seen on the next focus reload.

- **Shared rows** (PR 1, moved out of `summary/routes.ts` unchanged): `apps/api/src/summary/periodRows.ts`
  - `incomeRows(db, ledgerId, first, last): Promise<RowDataPacket[]>`: `{ month: 'YYYY-MM', income_eur }`, one per
    month with income.
  - `spentRows(db, ledgerId, first, last)`: `{ category_id, month, spent_eur }`.
  - `addRows(rows, column, month?)`: moves with them, and `summary/routes.ts` imports all three.

- API:
  - `GET /api/ledgers/:id/months/:month/balance` (exists; guards unchanged).
    - 200 `{ balance: { openingEur: '-35.00', closingEur: '2352.50' } | null }` (PR 1). From PR 2 the balance also has
      `actual: boolean`.
    - `closingEur` is always the End the line shows: actual, else stored, else computed. Shipped builds (which ignore
      unknown fields) therefore show the right End.
    - Errors: 400 `invalid_request` (month), 401, 404 `ledger_not_found`, as today.
  - `PUT /api/ledgers/:id/months/:month/balance/actual-end` (PR 2), guards `[requireAuth, requireLedger]`, any member.
    - Body `{ amount: '-35.00' }`. Zod: `z.string().regex(SIGNED_AMOUNT_RE, 'expected an amount, 2 decimals at most')`
      (`money.ts`, up to 8 digits, which fits DECIMAL(12,2)).
    - Upsert `INSERT … ON DUPLICATE KEY UPDATE closing_eur = ?`. Ended months are allowed.
    - 200 `{ balance: MonthBalanceDto }`: the same month, read again after the write.
  - `DELETE /api/ledgers/:id/months/:month/balance/actual-end` (PR 2): deletes the row (idempotent) and answers 200
    `{ balance: MonthBalanceDto }`.
  - Errors for both, in check order (the guards are preHandlers; Zod runs in the handler):
    - 401;
    - 404 `ledger_not_found` for a non-member;
    - 400 `invalid_request` for a malformed month or amount (Zod, global handler);
    - **409 `no_balance`** when the month has no line: after the current Kyiv month, before the ledger's first month,
      or a ledger with no budget.
  - API tokens: both routes stay out of `WRITE_TOKEN_ROUTES`, so the connector gets 403 `insufficient_scope`.
    Read-scope tokens can GET, as today.
  - `MonthBalanceDto` (PR 2): `{ openingEur: string; closingEur: string; actual: boolean }`.

- App:
  - `api/types.ts` `MonthBalance` gains `actual: boolean` (PR 2, mirrored with the DTO), with JSDoc saying
    `closingEur` is the shown End and `actual` means it was set by hand.
  - `data/useMonthBalance.ts` (PR 4):
    `useMonthBalance(ledgerId, month): MonthBalanceState`, where
    `MonthBalanceState = { reload: () => void } & ({ status: 'loading' } | { status: 'error' } | { status: 'ready';
balance: MonthBalance | null })`.
    - Shaped like `useMonthCategories`, with the key `${ledgerId}/${month}/${version}`, and it still refetches on focus.
    - A failed refetch of the same key keeps the ready state, as today.
  - `data/monthBalance.ts` `balanceLine` (PR 4) adds ` (actual)`: `'Start −€35 → End €120 (actual)'`.
  - `format.ts` `normalizeBalance(text): string | null` (PR 4) → a signed `'-35.00'`-style string, or null.
    - Trims the text and strips one leading `-` or U+2212 `−` (the app shows that minus). It then reuses
      `normalizePlanned` (`format.ts:115`) for the rest, so there's no second regex: a comma works, up to 8 digits
      and 2 decimals. It puts the sign back unless the amount is zero, so `'-0'` → `'0.00'`.
  - `data/actualEnd.ts` (PR 4):
    - `setActualEnd(ledgerId, month, amount): Promise<void>` → PUT;
    - `clearActualEnd(ledgerId, month): Promise<void>` → DELETE.
  - Route `app/actual-end.tsx`, `/actual-end?month=2026-11`, registered as a modal in `app/_layout.tsx`. The demo
    gets `demo-app/actual-end.tsx` (one-line re-export) and its own `_layout.tsx` entry. States:
    - a bad month param → `LoadError` "That link isn’t valid.";
    - loading → spinner;
    - error → `LoadError` "Couldn’t load November 2026’s balance. …" with Retry (`reload`);
    - ready + `null` (empty) → `LoadError` "November 2026 has no balance yet." with no Retry;
    - ready → the form:
      - caption: "November 2026 started at −€35. Enter what it really ended with; December 2026 starts from it."
      - field "Actual end in EUR" (`TextField`, prefilled with `closingEur`,
        `keyboardType="numbers-and-punctuation"`);
      - Save;
      - "Use calculated end", only when `actual`.
    - A success closes the modal with `closeToBudget(month)`. A refusal or failure keeps the form with its text, and
      nothing changes:
      - `no_balance` → "November 2026 has no balance yet." and the form locks;
      - otherwise "Couldn’t save. Check your connection and try again." (or "Couldn’t clear. …").
  - Budget tab: the line becomes a `Pressable` (`accessibilityRole="button"`, label = the line, hint "Sets the
    month’s actual end", `minHeight: 44`) with a small `edit` icon. It's there in every month that has a line, ended
    ones included, and opens `/actual-end?month=`.
  - Demo store (PR 3):
    - `StoreData.actualEnds: Map<'YYYY-MM', number>` (cents);
    - `balanceRoutes` gets GET, PUT and DELETE with the same rule. The demo has no imported months: its first listed
      month starts at €0.
    - 409 `no_balance` as the API.

- Reuses:
  - API: `kyivToday`, `monthOf`, `monthStart`, `nextMonthStart` (`dates.ts`); `MonthString` (`monthChecks.ts`);
    `SIGNED_AMOUNT_RE`, `toCents`, `centsToString` (`money.ts`); Statistics' income/spent queries (moved, not
    rewritten); the test helpers `makeUser`, `storeMonthList`, `authHeader`, `clearData`, `badMonthReply` and
    `addMember`.
  - App:
    - `TextField`, `Pressable`, `LoadError`, `Icon` (`edit`), `closeToBudget`, `usePushOnce`, `parseMonthParam`;
    - `eur`, `toCents`, `monthName`, `shiftMonth`, `kyivMonth`, `centsToInput`;
    - `income-item.tsx`'s form pattern (`inFlight` ref, `busy`, `gestureEnabled`, announced errors).
    - Not reused: `CategoryForm` (it's built around name + planned amount) and `AmountField` (its `decimal-pad` has no
      minus key on iOS).
  - Demo: the `Route` type, `refuse`, `fixtureStore`.
- New dependencies: none.

## Version

Each PR gets one bump (§8b). The numbers assume nothing else lands in between; otherwise each PR takes `main`'s
number and bumps once more (rule 4).

| PR  | Bump  | From → to       | Why (§8b row)                                                                                                                                                                           |
| --- | ----- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | minor | 1.16.1 → 1.17.0 | New capability: the Budget line exists for November onwards. The response shape is unchanged and there's no migration. A rollback just hides the line from November on again, as today. |
| 2   | minor | 1.20.1 → 1.21.0 | New routes, an optional new field and an additive migration. The previous release runs on 018 and ignores it.                                                                           |
| 3   | minor | 1.21.0 → 1.22.0 | The live demo build shows a line it didn't have (a new capability in a production build).                                                                                               |
| 4   | minor | → 1.20.0        | A new user action (set or clear the actual End).                                                                                                                                        |

Nothing reaches major: no field is removed or reshaped, no MCP tool changes, and every rollback keeps working. With
a new native build on a rolled-back API, a missing `actual` reads as falsy, so there's no "Use calculated end", and a
PUT answers 404, which shows "Couldn’t save".

## Slices

### PR 1 — `feat/month-balance`: compute and read

- [x] 0. Bump version to 1.17.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.17.0
- [x] 1. Move the Statistics income and spent queries into their own module
  - Files: apps/api/src/summary/periodRows.ts (new), apps/api/src/summary/routes.ts
  - Change: `incomeRows`, `spentRows` and `addRows` move as they are (Contracts). The summary route calls them.
    Behaviour-preserving.
  - Tests: `summary.int.test.ts` unchanged and green (it must run, not skip).
  - ~50 lines
- [x] 2. Add the month balance carry-over rule
  - Files: apps/api/src/balances/carry.ts (new), apps/api/test/balanceCarry.test.ts (new)
  - Change: `walkStart` and `carryBalance` (Contracts, without `actual`). Months step with `monthOf(nextMonthStart())`.
  - Tests: table style, with the arithmetic in comments.
    - An imported month returns its stored values and ignores its flow: Oct stored {0, −3500} with an Oct flow of
      +99900 → {0, −3500}.
    - The month after an imported one: Nov flow 250000 − 11250 = 238750 → {−3500, 235250}.
    - A chain: Dec flow 10000 − 4000 = 6000 → {235250, 241250}. Jan 2027 with no flow entry → {241250, 241250}
      (it crosses the year).
    - No imported months: Sep first with a flow of −1500 → {0, −1500}; Oct with a flow of +25000 → {−1500, 23500}.
    - Imported months after computed ones: first month 2025-09, stored from 2026-01. Dec 2025 is computed from €0,
      and Jan 2026 keeps its stored Start.
    - `walkStart` picks the latest imported month before M: stored Jan and Oct, asking Nov → `{ from: '2026-11',
openingCents: -3500n }`. Asking for the first month itself → `{ from: first, openingCents: 0n }`.
  - ~150 lines
- [x] 3. Work out each month's balance after the last imported one
  - Files: apps/api/src/balances/routes.ts, apps/api/test/balances.int.test.ts, apps/mobile/src/app/(tabs)/budget.tsx
    (comment only)
  - Change:
    - A local `monthBalance(ledgerId, month, at)` does the 4 queries of PR 1 and the walk. It returns `null` outside
      `first…current` and checks the month against the current Kyiv month before any query.
    - Flows are `toCents(income_eur)` minus `toCents(spent_eur)` per month.
    - The module comment and the JSDoc stop saying "read-only, rows from the import".
    - The comment at `budget.tsx:54` ("only months with imported balances have a line") is changed to say every
      month from the ledger's first one up to the current one has a line.
  - Tests:
    - The suite clock becomes `let at` with `now: () => at`. `authHeader` is called after setting `at`, because
      sessions last 30 minutes.
    - Data is seeded with raw SQL: `storeBalance` (exists), `storeIncome` (like `categories.int.test.ts`'s) and
      `storeExpense`, a new local helper (`INSERT INTO expenses (category_id, expense_date, name, amount_eur,
created_by, deleted_at)`). Nov gets a list via `storeMonthList(db, id, '2026-11', [])`.
    - Cases:
      - "starts the month after an imported one at its End" (replaces "answers none for a month without a row"):
        - Oct stored `0.00`/`-35.00`; Nov income 2500.00; Nov expenses 12.50 and 100.00, plus a deleted 7.00 and a
          stranger's 9.00 that don't count;
        - → Nov `{ openingEur: '-35.00', closingEur: '2352.50' }`.
      - "carries a chain of computed months": at 2027-01-10. Plus Dec income 100.00 and spent 40.00 → Dec
        `'2352.50'`/`'2412.50'`, Jan `'2412.50'`/`'2412.50'`.
      - "follows the current month's expenses and income", through the API at 2026-11-21: start End `-35.00`.
        - POST a 20.00 EUR expense → `-55.00`;
        - PUT it to 30.00 → `-65.00`;
        - DELETE it → `-35.00`;
        - POST income 100.00 → `65.00`.
      - "keeps an imported month as stored": add Oct income 500.00 and an Oct expense 10.00 → Oct still
        `'0.00'`/`'-35.00'`.
      - "starts a ledger without imported balances at €0": makeUser's first list is 2026-09, and a Sep expense is
        15.00 → Sep `'0.00'`/`'-15.00'`, Oct starts `'-15.00'`.
      - "has no balance before the first month, after the current one, or without a budget":
        - Aug → `null`;
        - Dec at 2026-11-21 → `null`;
        - a ledger whose `category_months` rows are all deleted → Nov `null`.
      - "turns to the next month at midnight in Kyiv": Dec is `null` at 2026-11-30T21:30:00Z (23:30 Kyiv), and a
        balance at 2026-11-30T22:30:00Z (00:30 on 1 December).
      - Existing cases stay as they are: stored Jan/Feb (first month = Jan), any member, another ledger's rows, 400,
        401, 404.
  - Verify: web at 390×844 on the laptop's ledger 1 (launch configs `api` + `web`):
    - Budget for Oct 2026 shows its stored line unchanged;
    - Nov 2026 shows `Start −€35 → End …`, with End − Start equal to Statistics' November left;
    - Dec shows no line.
  - ~190 lines (tests ~140). A route and its tests don't split into two green halves.
- [x] 4. Say in the READMEs that months after the import are worked out in the app
  - Files: README.md (the `import-balances` paragraph), deploy/README.md ("Importing each month's balances from Notion")
  - Change: one sentence each. The import covers January–October 2026, and from the month after the last imported one
    the API works each month out (brief 102).
  - ~6 lines

### PR 2 — `feat/month-actual-end`: actual End in the API

- [x] 0. Bump version to 1.21.0 (`main`'s next minor)
  - Files: package.json, apps/mobile/app.json
- [x] 5. Add the month_actual_ends table
  - Files: apps/api/migrations/018_month_actual_ends.sql (new), apps/api/test/monthActualEnds.migration.int.test.ts
    (new, like `categoryOrders.migration.int.test.ts`), apps/api/test/helpers.ts (`DATA_TABLES`)
  - Tests: the columns `ledger_id int unsigned NO`, `balance_month date NO`, `closing_eur decimal(12,2) NO`, and a
    second `runMigrations` → `[]`.
  - ~40 lines
- [x] 6. Show a month's actual End and start the next month from it
  - Files:
    - apps/api/src/balances/carry.ts, apps/api/test/balanceCarry.test.ts
    - apps/api/src/balances/routes.ts (query 3, `actual` in the DTO), apps/api/test/balances.int.test.ts
    - apps/mobile/src/api/types.ts (`actual: boolean`), apps/mobile/test/monthBalance.test.ts (each `MonthBalance`
      literal gains `actual: false`, or the app typecheck fails)
  - Change: `KnownMonths.actual` and the `actual` result flag (Contracts). `walkStart` also anchors on an actual month.
  - Tests:
    - Unit:
      - an actual End on a computed month replaces its End, and the next month starts from it;
      - one on an imported month replaces only its End;
      - an imported month after a month with an actual End keeps its stored Start;
      - `walkStart` anchors on the latest imported or actual month.
    - Int, with a row seeded by SQL:
      - Nov actual 120.00 → `{ '-35.00', '120.00', actual: true }`;
      - at 2027-01-10, Dec starts `'120.00'`;
      - an actual on imported Oct → Oct `'0.00'`/`'50.00'`, `actual: true`, and Nov starts `'50.00'`.
    - Existing expectations gain `actual: false`.
    - App: `monthBalance.test.ts`'s `balanceLine` table is unchanged apart from `actual: false` on each literal, and
      stays green.
  - ~145 lines
- [x] 7. Let members set and clear a month's actual End
  - Files: apps/api/src/balances/routes.ts, apps/api/test/actualEnd.int.test.ts (new)
  - Change: PUT and DELETE as in Contracts. Zod params and body come first, then `monthBalance` → 409 `no_balance`,
    then the write, then the month is read again for the reply. No lock: the only check is "has a line", and racing
    it with a category-list edit leaves at most an unused row.
  - Tests (at 2026-11-21, Oct stored `0.00`/`-35.00`):
    - PUT Nov `'120.00'` → 200 `{ balance: { '-35.00', '120.00', actual: true } }`, and GET agrees;
    - a second PUT `'-12.50'` replaces it;
    - a member can set it;
    - DELETE → `{ '-35.00', '-35.00', actual: false }`, and a DELETE with nothing set → same 200;
    - an ended month (Oct): PUT `'50.00'` → 200, and Nov's Start `'50.00'`;
    - re-running `importBalances(db, id, [Oct 0.00/-35.00])` (from `notion/balancesImport.ts`) leaves Oct's actual
      End in place;
    - 400 for amounts `'12.345'`, `'abc'`, `'1e3'`, `''`, a missing amount and a number `12`, and for month `2026-13`
      (`badMonthReply`);
    - 401;
    - 404 `ledger_not_found` for a non-member;
    - an API token (write scope) gets 403 `insufficient_scope` on PUT;
    - 409 `no_balance` for Dec (after the current month) and Aug (before the first), for both PUT and DELETE.
  - ~170 lines
- [x] 8. Note hand-set actual Ends next to the balances import
  - Files: README.md, deploy/README.md
  - Change: one sentence each. Actual Ends set on the Budget tab live in `month_actual_ends`, so a re-import never
    touches them.
  - ~4 lines

### PR 3 — `feat/month-balance-demo`: the demo follows the rule

- [x] 0. Bump version to 1.22.0 (`main`'s next minor)
- [x] 9. Work out the demo's month balances
  - Files: apps/mobile/src/demo/balanceRoutes.ts, apps/mobile/test/demoBalance.test.ts
  - Change: GET walks from the first listed month (live `monthRows`) at €0 up to the asked month. Its flow is income
    `toCents` minus live expenses (`removal === null`, `expenseDate` in the month). It answers `null` outside
    `first…kyivMonth(now)`, and `actual: false`.
  - Tests (`fixtureStore`, NOW 2026-11-15):
    - Oct `{ '0.00', '-10.00', false }` and Nov `{ '-10.00', '170.00', false }` (200 − 10 − 10);
    - Sep and Dec `null`;
    - after DELETE of expense 11, Nov ends `'180.00'`.
    - The old "answers none" case is replaced.
  - Verify: `yarn mobile export:web` + `yarn mobile check-builds` (no module-list change is expected), and the demo web
    build at 390×844: Budget for last month shows `Start €0 → End …`, and this month starts from that End.
  - ~85 lines
- [ ] 10. Let the demo set and clear a month's actual End
  - Files: apps/mobile/src/demo/state.ts (`actualEnds`), apps/mobile/src/demo/sampleData.ts,
    apps/mobile/test/demoFixture.ts (`actualEnds: new Map()`), apps/mobile/src/demo/balanceRoutes.ts,
    apps/mobile/test/demoBalance.test.ts
  - Change: GET honours `actualEnds`. PUT/DELETE `/^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/balance\/actual-end$/`
    answer `{ balance }` or refuse 409 `no_balance`.
  - Tests:
    - PUT Oct `'50.00'` → Oct `{ '0.00', '50.00', true }`, and Nov `{ '50.00', '230.00', false }`;
    - DELETE Oct → back to `'-10.00'`;
    - PUT Dec and PUT Sep reject with `ApiError` 409 `no_balance`.
  - ~90 lines

### PR 4 — `feat/month-actual-end-app`: the app control

- [ ] 0. Bump version to 1.20.0 (or `main`'s next minor)
- [ ] 11. Mark an actual End on the Budget line
  - Files: apps/mobile/src/data/useMonthBalance.ts, apps/mobile/src/data/monthBalance.ts,
    apps/mobile/src/app/(tabs)/budget.tsx, apps/mobile/test/monthBalance.test.ts
  - Change: the hook returns `MonthBalanceState` (Contracts). Budget reads
    `balance.status === 'ready' ? balanceLine(balance.balance) : null`, which is the same behaviour as today.
    Keep PR 1's Undo reload: `useUndoOffer` still calls the balance's `reload`, now through a version in the hook's
    key, as `useIncome` does, so a reload's fetch can be cancelled like a focus one (review nit on PR 1).
    `balanceLine` adds ` (actual)`.
  - Tests:
    - the existing table (already given `actual: false` in slice 6);
    - `{ '-35.00', '120.00', true }` → `'Start −€35 → End €120 (actual)'`;
    - `null` → `null`.
  - Verify: a browser check that the Budget line looks as before.
  - ~70 lines
- [ ] 12. Add signed amount parsing and the actual End requests
  - Files: apps/mobile/src/format.ts (`normalizeBalance`), apps/mobile/src/data/actualEnd.ts (new),
    apps/mobile/test/format.test.ts
  - Tests, a `normalizeBalance` table:
    - `'120'` → `'120.00'`;
    - `'-35'` → `'-35.00'`;
    - `'−35,5'` → `'-35.50'`;
    - `' 12.05 '` → `'12.05'`;
    - `'0'` and `'-0'` → `'0.00'`;
    - `''`, `'-'`, `'12.345'`, `'123456789'`, `'1e3'` and `'--5'` → `null`.
  - ~60 lines
- [ ] 13. Add the actual End form
  - Files: apps/mobile/src/app/actual-end.tsx (new), apps/mobile/src/app/\_layout.tsx,
    apps/mobile/src/demo-app/actual-end.tsx (new), apps/mobile/src/demo-app/\_layout.tsx,
    apps/mobile/src/closeToBudget.ts (its JSDoc says "category modal"; widen it to any modal opened from Budget),
    apps/mobile/demo-modules.txt (`check-builds --accept`; expect `+src/app/actual-end.tsx`,
    `+src/demo-app/actual-end.tsx`, `+src/data/actualEnd.ts`)
  - Change: the screen and its states from Contracts. Styles go in `makeStyles` and copy `income-item.tsx`.
  - Verify: web at 390×844, by opening `/actual-end?month=2026-11` directly:
    - loading, then the prefilled End;
    - a bad link, and `month=2027-05` → "has no balance yet";
    - a malformed amount → its message;
    - Save and "Use calculated end" close back to Budget;
    - with PUT blocked in DevTools → "Couldn’t save…", the form stays, and the line is unchanged after Back.
  - ~190 lines (a screen with its five states doesn't split into green halves)
- [ ] 14. Open the actual End form from the Budget line
  - Files: apps/mobile/src/app/(tabs)/budget.tsx
  - Change: the line becomes the `Pressable` from Contracts, opening the form with `pushOnce`.
  - Verify: AC7's browser and iPhone checks (below).
  - ~30 lines

## AC → evidence

| AC                                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 API: Nov Start −€35, End by the rule; Dec from Nov; chain; current month follows add/edit/delete and income | `balances.int.test.ts`: "starts the month after an imported one at its End", "carries a chain of computed months", "follows the current month's expenses and income". `balanceCarry.test.ts` rows. Ledger 1 itself: PR 1's browser check.                                                                                                                                                                                                                                                                                                                      |
| AC2 API: imported months unchanged                                                                              | `balances.int.test.ts` "keeps an imported month as stored". Unit: "an imported month returns its stored values".                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AC3 API: set → shown and next Start; clear reverts; ended month, 404, 401, 400, future refused                  | `actualEnd.int.test.ts` (slice 7), all its cases. Slice 6's int and unit cases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AC4 API: no imports → €0; none before first budget or after current                                             | `balances.int.test.ts` "starts a ledger without imported balances at €0", "has no balance before the first month, after the current one, or without a budget", "turns to the next month at midnight in Kyiv".                                                                                                                                                                                                                                                                                                                                                  |
| AC5 App: Nov line on ledger 1; set/clear updates the line and the next Start; a failed save says so             | PR 1: web shows Nov `Start −€35 → End …` on ledger 1 with no app change, and Nov's End − Start equals Statistics' November income − spent. PR 4: slice 13/14 checks, `monthBalance.test.ts`, `normalizeBalance` table. The next Start is checked on Nov after setting Oct (ended) on web.                                                                                                                                                                                                                                                                      |
| AC6 Demo computes (tests) and shows the line                                                                    | `demoBalance.test.ts` (slices 9–10). Manual: the demo web build's Budget tab shows last month `Start €0 → End …` and this month starting from it, and (PR 4) set/clear works there.                                                                                                                                                                                                                                                                                                                                                                            |
| AC7 Web 390×844: Nov/Dec on ledger 1, set/clear, light/dark; iPhone: the line and setting                       | PR 4, in the in-app browser (launch configs `api` + `web`). Steps: (1) Nov line, with the edit icon visible. (2) Tap it, set `120`, and the line reads `… → End €120 (actual)`. (3) Use calculated, and it reverts. (4) Set Oct (ended) to `50`; Oct reads `(actual)` and Nov starts `€50`; then clear it. (5) December shows no line until 1 December Kyiv; the Dec-from-Nov carry is proven by the int tests' clock. (6) Repeat in light and dark. iPhone in Expo Go: the line, the modal, typing `-35` on the numbers-and-punctuation keyboard, and saving. |
| AC8 Gates                                                                                                       | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice. `yarn mobile export:web` + `yarn mobile check-builds` in slices 9, 10 and 13.                                                                                                                                                                                                                                                                                                                                                                                                  |

## Not doing (YAGNI)

- No cache of computed balances, and no transaction across the read's queries.
- No `calculatedEur` or `source` enum in the DTO. The app only needs `actual`. "Use calculated end" doesn't show the
  calculated amount.
- No who/when columns on `month_actual_ends`.
- No change to `import-balances` or `month_balances`, and no recomputing January–October.
- No editing Start. No balance on Home, Statistics or the MCP connector (no tool; `apps/mcp` never reads balances).
  The PUT/DELETE routes stay out of the token write list.
- No Android keyboard handling (`numbers-and-punctuation` is iOS-only; other platforms fall back to a keyboard with
  a minus).
- No `AmountField` `keyboardType` prop: one caller, so `TextField` is used directly.

## Risks

- The suite's clock moves (Nov → Jan 2027), and sessions last 30 minutes. Slice 3 calls `authHeader` after each clock
  change; its cases show it.
- `MIN(list_month)` and `SUM(...)` come back as `'YYYY-MM-DD'`/decimal strings, or NULL over no rows
  (`dateStrings: ['DATE']`, `decimalNumbers: false`). Slice 3's "without a budget" and "no flow" cases prove it.
- Ledger 1's data, checked on 2026-11-22:
  - The first list is 2026-01, the same month as the first import, so "the earlier of" makes no difference for
    ledger 1.
  - October closes at −35.00.
  - November has no list yet, so November's End on ledger 1 is −35 + November income. The line still renders,
    because it sits outside the categories branch (`budget.tsx:125`).
  - PR 1's browser check (slice 3) confirms it.
- Long histories: a ledger with no imported or actual month walks from its first month. That's still 5 queries
  (grouped, over indexed ranges); only the scanned range grows. Slice 3's queries are the evidence. If it shows up as
  slow later, setting any actual End shortens the walk.
- The 44pt line button pushes the Budget content down by about 16px. Slice 14's 390×844 check shows it; if it looks
  wrong, note it under Deviations and tighten the header's padding.
- iOS keyboard: `decimal-pad` has no minus key, hence `numbers-and-punctuation` (RN docs: iOS-only value). The iPhone
  check in slice 14 proves it. react-native-web gives a text keyboard.
- The worktree's API integration tests skip unless `DATABASE_URL_TEST` is exported from the main checkout's `.env`.
  Every API slice must show its cases ran, not skipped.

## Open questions

- Blocking: no. Which month does the line start at? The plan uses **the earlier of the first budgeted month and the
  first imported month**, so that no imported month disappears (AC2, and today's behaviour). The brief literally says
  "from the first budgeted month". For ledger 1 the two are the same month, 2026-01 (checked 2026-11-22).
- Blocking: no. An actual End on a month just before an imported month (e.g. September): the imported October keeps
  its stored Start (AC2 wins over "the next month starts from it"). Months after the imports always follow the rule.
- Blocking: no. Wording:
  - the line: `Start −€35 → End €120 (actual)`;
  - the modal: title "Actual end", field "Actual end in EUR", buttons "Save" and "Use calculated end";
  - the refusal code `no_balance`.
- Blocking: no. Four PRs (each under ~400 lines) rather than the three the orchestrator suggested. The demo got its
  own small PR because adding it to PR 1 or PR 4 would push either one to about 470 lines.
- Blocking: no. PR 3 (demo only) is called minor because the live demo gains a visible line. Patch is the other
  reading.

## Follow-ups

- Migration 016's comment "Nothing in the app reads it yet" is stale since brief 090, but migrations aren't edited
  after merge.
- `withTransaction`-free reads across several queries, here and in Statistics, could give a mixed snapshot under a
  concurrent write. Harmless today; worth noting if balances are ever exported.

## Deviations

- PR 1, review: `useMonthBalance` gets a `reload` and the Budget tab calls it when an Undo restores a category, so the
  current month's End moves without leaving the tab (it refetched only on focus, fine while every line was a static
  import). PR 4 slice 11 reshapes the hook anyway and keeps that call. Checked on web: removing groceries (€112.50)
  raised End to €2,465; Undo brought it back to €2,352.50 in place.
- PR 2 slice 0: briefs 103–108 took 1.17.x–1.20.1 first, so PR 2 bumps 1.20.1 → 1.21.0 (rule 4); it branches from
  `origin/main` 3168377.
- PR 3 slice 0: PR 2 shipped as 1.21.0, so PR 3 bumps 1.21.0 → 1.22.0; it branches from `origin/main` 1caa333.

## Consolidate

PR 1, against origin/main 24e1200: reused 3 · extracted 0 · left 3.

- REUSE: income and spent come from Statistics' own queries (`incomeRows`, `spentRows`, moved in slice 1), and month
  stepping uses `dates.ts` `nextMonthStart`/`monthOf`.
- LEAVE the first-budgeted-month query in `balances/routes.ts` against `monthLists.ts` `hasBudget`: same predicate,
  but `MIN(list_month)` over the ledger versus "does this one month have a row". Merging them would change one of
  them.
- LEAVE `summary/routes.ts`'s `monthIndex`/`periodMonths` arithmetic against `carry.ts`'s `nextMonth`: Statistics
  steps by arithmetic on purpose (9999-12 has no next month), and the carry walk never goes past the current month.
- LEAVE the per-month flow loop in `monthBalance` against `addRows`: `addRows` sums one month per call, so a walk of
  n months would scan the rows n times. One pass builds the map.

PR 2, against origin/main 3168377: reused 2 · extracted 1 · left 1.

- REUSE: `SIGNED_AMOUNT_RE` (money.ts) for the body, and `monthBalance` for the "has a line" check and the reply, so
  the PUT/DELETE answer is the GET's answer.
- EXTRACT: `toDto` in `balances/routes.ts`, shared by GET, PUT and DELETE; `changeActualEnd` holds the check → write →
  read-again order for both writes.
- LEAVE the `month_actual_ends` read next to the `month_balances` read: different columns and maps, two short queries.

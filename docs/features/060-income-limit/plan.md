# Plan: Planned never above income

Status: skeptic-approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/income-limit
Base: origin/main @ 2edd350 (058, 059 and 061 merged; custom TabBar, Income tab before Budget)

## Approach

This is Part 3 of `../058-ledger-income/plan.md`. I re-checked it against the code as merged. Its contracts stand,
with three changes from re-checking:

- 3.4 is split in two (planned, then restore).
- The app messages (3.2) come last.
- The planned/restore rule tests go in `categories.int.test.ts`, which already has `plan`, `removeFrom`, `restoreTo`
  and `idOf`.

How it works:

- **The rule** is `apps/api/src/income/limit.ts`: a pure `overIncomeBy` on bigint cents, plus `checkIncome`, which
  reads the month's two totals and applies a delta.
- Four write paths each compute their delta from the row they already read, ask `checkIncome`, and return before
  writing when the answer is "over". So "writes nothing" needs no rollback. The paths are `setPlanned`,
  `restoreToMonth` (the Undo of Remove, which is also the app's "delete category"), income PUT and income DELETE. The
  refusal is 409 `{ error: 'over_income', overEur }`.
- **Concurrency.** Every one of these paths already takes `lockLedger` as its first statement (`income/routes.ts`
  `refuseChange`, and all six `monthLists.ts` writers). So writes for one ledger are serialized, and each check
  reads after the lock under REPEATABLE READ. I checked the test DB: `@@transaction_isolation` is
  `REPEATABLE-READ`.
- **App.** The Budget tab gets an Income / Planned / Left-to-plan card. `ApiError` carries the parsed error body.
  One pure `overIncomeText` gives the message on the three places a refusal can reach the user:
  - the planned-amount editor;
  - the Undo bar of a category removal (`delete-category.tsx`'s `refusedText`, shown on Budget or Home);
  - the income-item form (Save and Delete).

Alternative considered: write first, re-sum, and throw to roll back (058). That is generic, but every route would
have to catch refusals thrown through `withTransaction`. Each path already knows its delta, so checking before the
write is smaller.

Other writers of `category_budgets`, `category_months` and `income_items`, checked:

- `notion/historyImport.importMonth` takes the ledger row lock first (`ledgerOwner(conn, …, true)`). It only writes
  January–October 2026 (`history.ts` `LAST_MONTH`), which is before the rule.
- `admin.createUserWithLedger` inserts €0 list rows for a ledger nobody else can see yet. There is no budget and no
  race.
- `deploy/export-ledger.sh` is an out-of-band SQL dump (see Not doing).
- Nothing else writes these tables.

## Contracts

- DB: none. This uses `income_items` (012), `category_budgets` and `category_months` as they are.
- API, `apps/api/src/income/limit.ts` (new):

  ```ts
  /** The first 'YYYY-MM' month whose planned total may not exceed its income total (brief 060). */
  export const INCOME_RULE_START = '2026-11';
  /** A month's totals, or a change to them, in EUR cents. */
  export interface MonthTotals {
    plannedCents: bigint;
    incomeCents: bigint;
  }
  /** A change the rule refused: it would leave planned this many cents above income. */
  export interface OverIncome {
    overCents: bigint;
  }
  /**
   * Cents by which a change leaves `month`'s planned above its income; 0n when the rule lets it through: a month
   * before INCOME_RULE_START, a change that raises no planned amount and lowers no income, or one that ends within
   * income (equal is fine).
   */
  export function overIncomeBy(month: string, before: MonthTotals, after: MonthTotals): bigint;
  /**
   * Reads the month's planned total (category_budgets of live categories with a live row in the month's list) and
   * income total, applies `delta`, and returns the refusal or null. Runs inside a transaction whose first statement
   * was lockLedger.
   */
  export async function checkIncome(
    conn: PoolConnection,
    ledgerId: number,
    month: string,
    delta: MonthTotals,
  ): Promise<OverIncome | null>;
  /** The 409 body. */
  export function overIncomeError(over: OverIncome): { error: 'over_income'; overEur: string };
  ```

  - **The planned sum** is `COALESCE(SUM(b.planned_eur), 0)` over `category_budgets b`, joined to `categories c`
    (`c.ledger_id = ? AND c.deleted_at IS NULL`) and to `category_months m`
    (`m.category_id = b.category_id AND m.list_month = b.budget_month AND m.deleted_at IS NULL`), for one
    `budget_month`.
    - It joins `category_months` directly, not through `inMonthList`, so `limit.ts` doesn't import `monthLists.ts`
      (no cycle).
    - It matches what Budget sums: the GET list's live categories in the month's list.
    - `(category_id, list_month)` is the primary key, so no row counts twice.
  - **The income sum** is `COALESCE(SUM(amount_eur), 0)` over `income_items` for the ledger and `income_month`.
  - **Empty and large sums.** A `SUM` over no rows comes back `'0.00'` through COALESCE (checked on the test DB), and
    a large one comes back as an exact string (`'100000000.00'`). `toCents` turns both into bigint.
  - **The deltas:**
    - planned: `new − current`;
    - restore: `+restored amount`;
    - income edit: `new − old`;
    - income delete: `−old`.

- API, `apps/api/src/categories/monthLists.ts`:
  - `setPlanned(...)`: `Promise<boolean>` becomes `Promise<'set' | 'not_found' | OverIncome>`. Its in-list SELECT
    becomes `SELECT COALESCE(b.planned_eur, 0) AS planned_eur FROM categories c LEFT JOIN category_budgets b ON
b.category_id = c.category_id AND b.budget_month = ? WHERE …`.
  - `restoreToMonth(...)` becomes `Promise<'restored' | 'not_found' | 'name_taken' | OverIncome>`. Its SELECT adds
    `COALESCE(b.planned_eur, 0) AS planned_eur` through
    `LEFT JOIN category_budgets b ON b.category_id = m.category_id AND b.budget_month = m.list_month`. A removal keeps
    the budget row, so this is the amount the Undo brings back.
- API routes. The check order is unchanged, with the new code last. Only the error codes change:
  - `PUT /api/ledgers/:id/categories/:categoryId/months/:month/planned`: 204. Errors in order: 400 → 409
    `month_ended` → 404 `not_found` → **409 `over_income`**.
  - `POST /api/ledgers/:id/categories/:categoryId/months/:month/restore`: 204. Errors in order: 409 `month_ended` →
    404 `not_found` → 409 `name_taken` → **409 `over_income`**.
  - `PUT /api/ledgers/:id/income/:incomeId`: 204. Errors in order: 400 → 404 `not_found` → 409 `month_ended` →
    **409 `over_income`**.
  - `DELETE /api/ledgers/:id/income/:incomeId`: 204. Errors in order: 404 `not_found` → 409 `month_ended` →
    **409 `over_income`**.
  - The `over_income` body is `{ error: 'over_income', overEur: '12.50' }` (decimal string, > 0).
- API, `apps/api/src/income/routes.ts`: `refuseChange` becomes `findChangeable(conn, ledgerId, incomeId):
Promise<Refusal | { month: string; amountCents: bigint }>`. It still locks first, and its SELECT adds `amount_eur`.
  `sendRefusal` takes `Refusal | OverIncome`, and sends 409 `overIncomeError(...)` for the latter.
- App, `apps/mobile/src/api/client.ts`: `ApiError`'s constructor becomes
  `(status, code, readonly body: Record<string, unknown> = {})`, and `api()` passes the parsed `data`. The one
  constructor call is `client.ts:104`.
- App, `apps/mobile/src/data/overIncome.ts` (new):
  `overIncomeText(code: string, body: Record<string, unknown>): string | null`. It gives "Planned would exceed income
  by €12.50." for `over_income` with a decimal-string `overEur`, "Planned would exceed income." when `overEur` is
  missing or malformed, and null for any other code. Well-formed means a string matching `/^\d+\.\d{2}$/`, the shape
  `centsToString` sends. It takes plain values, so Node tests don't load `client.ts`.
- Consumers of the message:
  - `app/planned-amount.tsx` `Editor.save`;
  - `app/delete-category.tsx` `refusedText`. Its Undo bar shows on Budget (from the rename screen) or Home (from
    category detail);
  - `app/income-item.tsx` `IncomeForm.run`, which is shared by Save and Delete.

  None of them sets `gone`, so a smaller amount can still be saved. `(tabs)/income.tsx` (copy only adds income),
  `add-category` and Budget's copy (both €0) can't receive the code.

- App, `(tabs)/budget.tsx`: `useIncome(ledger.ledgerId, month)`, and a figures card above "Categories" when the month
  has categories (contents in slice 1).
- Reuses:
  - API: `lockLedger`, `withTransaction`, `toCents`, `centsToString`, `monthEnded`.
  - App: `useIncome`, `incomeCents`, `plannedCents`, `eur`, `toCents`, `LoadError`, `restoreRefusedText`,
    `monthEndedText`, `notListedText`, `notInMonthText`.
  - Tests: `storeMonthList`, `storeItem`, `addMember` (`src/ledgers/members.js`), and `categories.int.test.ts`'s
    `plan`, `removeFrom`, `restoreTo` and `idOf`.
- New dependencies: none.

## Slices

- [x] 1. Show income, planned and left to plan on the Budget tab (~65)
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change: a month with categories gets a card above the "Categories" head, in one accessible group labelled
    "Income €X, planned €Y, left to plan €Z". It shows three figures:
    - Income, from `incomeCents(income.items)`;
    - Planned, from `plannedCents(data.categories)`;
    - Left to plan, which is income − planned in cents, in `colors.danger` when below 0 (`eur` prints "−€50").

    The card is hidden while income loads. If income fails before any load, it shows `LoadError` "Couldn’t load
    {Month}’s income. Check your connection and try again." with Retry (`income.reload`). If a reload fails after a first load, the card keeps its figures and a small
    `LoadError` "Couldn’t refresh. Check your connection and try again." with Retry shows under it, like the tab's. It shows in every month,
    before the rule too. Styles come from `makeStyles` and colours from the palette.

  - Verify (web 390×844, user `claude-qa-059`, ledger 35, the worktree's API on :3000 and Metro on :8081):
    - with November income €100 and €150 planned (seeded), it shows "Left to plan −€50" in red;
    - October shows its own figures;
    - adding income on the Income tab and coming back to Budget updates the card (focus reload);
    - an empty month shows the empty card only.

    Also run typecheck and lint.

- [ ] 2. Add the over-income rule's arithmetic (~90)
  - Files: `apps/api/src/income/limit.ts` (`INCOME_RULE_START`, `MonthTotals`, `OverIncome`, `overIncomeBy`,
    `overIncomeError`), `apps/api/test/incomeLimit.test.ts`.
  - Tests, a table in `money.test.ts` style. Each comment gives the sum; the pair is (planned, income):
    - 2026-11:
      - (0, 10000) → (10000, 10000): 0n. Equal is allowed.
      - (0, 10000) → (10001, 10000): 1n.
    - Already over, (15000, 10000):
      - planned → 14000: 0n;
      - income → 12000: 0n;
      - unchanged: 0n (a title-only edit, or restoring a €0 category);
      - planned → 15050: 5050n;
      - income → 9000: 6000n.
    - (5000, 10000): income → 4000 gives 1000n; income → 5000 gives 0n.
    - 2026-10, (0, 0) → (9999999999, 0): 0n. 2027-01 is checked: (0, 0) → (1, 0) gives 1n.
    - 15 × 99,999,999.99 planned against 0 income: 149999999985n, exactly.
    - `overIncomeError({ overCents: 1n })` gives `{ error: 'over_income', overEur: '0.01' }`; 150000n gives
      `'1500.00'`.
- [ ] 3. Refuse raising a planned amount above the month's income (~145)
  - Files:
    - `income/limit.ts` (`checkIncome`; it returns null before its two SUMs when the month is before
      `INCOME_RULE_START`, or the delta raises no planned amount and lowers no income);
    - `categories/monthLists.ts` (`setPlanned`);
    - `categories/routes.ts` (PUT planned maps `OverIncome` to 409 `overIncomeError`);
    - `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. Two existing tests plan November with no income, and would now get 409:
    - "starts a month whose categories were all removed afresh" (~line 689, gym 15);
    - "sets and replaces the amount for that month only" (~line 802, gym 40).

    Each first inserts a November income item with raw SQL (a local `storeIncome(month, amount)` helper), so they
    keep their meaning.

  - Tests: a new `describe('over-income rule')`, with November listed by `storeMonthList`. The DB is checked after
    each refusal.
    - **Raises:**
      - with €100 income, rent → '100' gives 204 (equal);
      - then groceries → '0.01' gives 409 `{ error: 'over_income', overEur: '0.01' }`, and groceries has no
        `category_budgets` row.
    - **Already over:** rent 150 and groceries 50 are planned with raw SQL, with no income.
      - rent → 120 gives 204;
      - rent → 120 again gives 204;
      - rent → 121 gives 409 `overEur: '171.00'`, and rent is still '120.00';
      - removing groceries gives 204;
      - adding €10 income (`POST …/income`) gives 201.
    - **Before the rule:** October rent → 500 with no income gives 204.
    - **Check order**, on a November that is over income (SQL):
      - raising a November category that isn't in the list gives 404, not 409;
      - with the suite's clock moved to `now = new Date('2026-11-30T22:00:00Z')` (1 December in Kyiv), then `auth = await authHeader(app, owner, now)`, because sessions last 30 minutes on the app clock, as at `categories.int.test.ts:423-424`, rent → 500 in November gives 409 `month_ended`, not `over_income`.
    - **Concurrency:** €60 income, and six different categories → '20' at once (`Promise.all`, owner and member
      alternating; the test first adds a member with `addMember(db, owner.ledgerId, member.userId)` and
      `authHeader`, as `income.int.test.ts` does in `beforeEach`). Exactly three get 204 and three get 409
      `over_income`, and the stored planned sum is '60.00'.
      - Prove-It: with `lockLedger` dropped from `setPlanned`, more than three get through. The developer runs this
        once and records it in Deviations.
- [ ] 4. Refuse an Undo of a removal that would plan above income (~75)
  - Files: `categories/monthLists.ts` (`restoreToMonth`), `categories/routes.ts` (restore maps `OverIncome`),
    `categories.int.test.ts`.
  - Tests, in November, in the same describe:
    - **Refused:** with €100 income and rent 80, remove rent, then set groceries → 50. Restoring rent gives 409
      `overEur: '30.00'`. Rent is still out of the list, its `category_months.deleted_at` stamp is unchanged, and its
      removed expense (added with `addSpend` on 2026-11-02 before the removal) is still deleted.
    - **Within income:** groceries → 20, then restoring rent gives 204, and rent is back at '80.00' with its expense.
    - **A €0 category:** in an already-over month (SQL), restoring a removed €0 category gives 204.
    - **Before the rule:** in October, with no income, restoring a removed category planned at 500 gives 204.
    - **Check order**, on a November that is over income:
      - restoring a removed rent planned at 80, whose name another category now has, answers `name_taken`, not
        `over_income`;
      - with the clock at `now = new Date('2026-11-30T22:00:00Z')`, then `auth = await authHeader(app, owner, now)`, because sessions last 30 minutes on the app clock, as at `categories.int.test.ts:423-424`, restoring it answers `month_ended`.
- [ ] 5. Refuse lowering or deleting income below the month's planned total (~110)
  - Files: `income/routes.ts` (`findChangeable`, then `checkIncome` in PUT and DELETE; `sendRefusal`),
    `apps/api/test/income.int.test.ts` (`describe('over-income rule')`).
  - Tests: November is listed (`storeMonthList`), with items A €60 and B €40 and rent planned at €100 (raw SQL).
    - A → 59.99 gives 409 `overEur: '0.01'`, and A is unchanged.
    - A title-only change at '60' gives 204.
    - A → 70 gives 204, then A → 60 gives 204.
    - DELETE B gives 409 `overEur: '40.00'`, and B stays.
    - Rent → 60 (SQL), then DELETE B gives 204.
    - Already over (rent 150): A → 61 gives 204, since it raises income.
    - In October, deleting the only item below a planned amount gives 204.
    - **Check order:** the suite's `now: () => clock` becomes a `let now`, reset to `clock` in `beforeEach` (as in
      `categories.int.test.ts`). With November over income and `now = new Date('2026-11-30T22:00:00Z')` (1 December in Kyiv), then `auth = await authHeader(app, owner, now)`, because sessions last 30 minutes on the app clock, as at `categories.int.test.ts:423-424`, A → 1 and DELETE B each answer 409 `month_ended`, not `over_income`, and both items are unchanged.
    - **Concurrency:**
      - six €20 items with rent 60, and six DELETEs at once: three 204, three 409, and income ends at '60.00';
      - items 50 + 50 and rent 50, with groceries → '50' (`PUT …/planned`) and a DELETE of one item at once: one
        204 and one 409, and planned ≤ income afterwards.
    - Prove-It as in slice 3, with the lock dropped from `findChangeable`, recorded in Deviations.
- [ ] 6. Explain an over-income refusal in the app (~80)
  - Files:
    - `apps/mobile/src/api/client.ts` (`ApiError.body`);
    - `apps/mobile/src/data/overIncome.ts`, `apps/mobile/test/overIncome.test.ts`;
    - `app/planned-amount.tsx`, `app/delete-category.tsx`, `app/income-item.tsx`.
  - Change: each screen tries `overIncomeText(err.code, err.body)` before its existing texts.
    - The planned editor and the income form stay editable: `gone` stays false. Delete stays available, and the item
      stays.
    - The Undo bar's `refusedText` returns the line, so the bar shows it as a refusal with no Retry.
  - Tests:
    - `over_income` with `{ overEur: '12.50' }` gives "Planned would exceed income by €12.50.";
    - `'1500.00'` gives "€1,500";
    - `'0.01'` gives "€0.01";
    - a missing `overEur`, `150` (a number), `'abc'`, `'12.5'` or `'-1.00'` (none matches `/^\d+\.\d{2}$/`) gives
      "Planned would exceed income.";
    - `month_ended`, `not_found` and `name_taken` give null.
  - Verify (web 390×844, same setup as slice 1, November seeded with SQL on the local DB): income €100; rent €140 and
    gym €10 planned.
    - **Planned editor:** groceries → 5 gives "Planned would exceed income by €55." The field stays editable, and
      groceries → 0 saves.
    - **Undo on Budget:** remove gym from Budget's rename screen. Undo gives the line in the bar, with no Retry.
    - **Undo on Home:** first re-seed gym at €10 in November's list with SQL (re-adding it with "+" brings it back at
      €0). Then remove gym from category detail. Undo gives the same line on Home's bar.
    - **Income form:** first re-seed gym at €10 in November's list with SQL. Then editing the €100 item to 90 gives
      "…by €60."; "Delete item" gives "…by €150.", and the item stays.
    - **Before the rule:** October accepts all of these.
    - Light and dark.
- [ ] 7. Say to add November's income before planning it (~3)
  - Files: `deploy/README.md` (step 5, "November").
  - Change: "Income tab → November → add the household's income; then Budget tab → November → Copy October's
    categories and set the planned amounts (they can't exceed the income)". The current text ("then set the planned
    amounts") is stale under the rule.
  - Verify: `yarn format:check`.

If slice 3 grows past ~170 lines, the two existing-test fixes move into their own earlier commit, then the
concurrency test into a commit after the rule.

Total is about 570 changed lines, tests included. 058 estimated ~480 for Part 3.

## AC → evidence

| AC                                                                       | Evidence                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 409 `over_income` for each change ≥ 2026-11; writes nothing; equal is OK | Slice 3 "raises" (planned), slice 4 "refused / within income" (Undo of Remove and delete, one route), slice 5 (income edit and delete); each checks the DB afterwards                                                      |
| Lowering, removing, adding income succeed when already over              | Slice 3 "already over"; slice 5 "already over" (raising income)                                                                                                                                                            |
| A month before 2026-11 accepts planned above income                      | Slice 2 table row; slice 3 October raise; slice 4 October restore; slice 5 October delete                                                                                                                                  |
| Holds under concurrent writes                                            | Slice 3 six raises; slice 5 six deletes and the mixed raise + delete; Prove-It runs recorded in Deviations                                                                                                                 |
| App: clear message; Budget shows income / planned / left to plan (web)   | Slice 6 Verify (editor, Undo on Budget and Home, income edit and delete); slice 1 Verify (card)                                                                                                                            |
| Unit tests: amount parsing and rule arithmetic (cents)                   | `incomeLimit.test.ts` (slice 2) and `overIncome.test.ts` (slice 6). Amount parsing is the existing `normalizeAmount`/`normalizePlanned` (`format.test.ts`) and `AMOUNT_RE`/`toCents` (`money.test.ts`), reused as they are |
| iPhone (Expo Go): the message works                                      | The user checks this at Gate B: the planned editor and the Undo bar                                                                                                                                                        |
| Gates green, integration tests ran                                       | Every slice. `DATABASE_URL_TEST` is exported from the main checkout's `.env` in the worktree                                                                                                                               |

## Not doing (YAGNI)

- **A "left to plan" hint inside the planned-amount editor, or a link from the Budget card to the Income tab.**
- **Removing the "€X planned" in Budget's section head,** even though the card repeats it (Open questions).
- **A rule check in the Notion history import.** It only writes January–October 2026 and takes the ledger lock.
- **A rule for `deploy/export-ledger.sh` imports.** That is an out-of-band SQL dump of one month's setup.
- **A per-month lock row, SERIALIZABLE isolation, or retry loops.**
- **Out of scope in the brief:** currencies other than EUR, recurring income, received vs expected income, and Notion
  sync of income.

## Risks

- **A writer that skips the ledger lock, or does a plain read before it,** would let a race through.
  - Today every writer of the three tables takes the lock first (Approach).
  - The concurrency tests in slices 3 and 5 check this, and the Prove-It runs show the tests can see a race.
  - If the race won't reproduce under `app.inject`, the developer records that in Deviations. The parallelism stays
    at six, under the pool's 10.
- **Existing November tests break.** Only two plan November through the route (`categories.int.test.ts` ~689 and
  ~802); slice 3 updates both. `notionHistory.int.test.ts:277` writes November budgets with raw SQL and is not
  affected.
- **Production.** November is planned with no income, so after deploy it refuses every raise and every Undo that
  brings an amount back, until income is added. The brief intends this. It needs 061 live in production first:
  confirm at Gate B before deploying.
- **Sums as DECIMAL strings into `toCents`.** The exact `overEur` values in slices 3–5 and the 15 × max row in
  slice 2 cover this. Empty and large sums were checked on the test DB.
- **The Undo window is 10 s.** Slice 6's Undo checks avoid racing it by seeding an already-over month with SQL, so
  the restore is refused with no second actor.

## Open questions

- **Not blocking.** Size is ~570 lines, against the ~400 per-brief guide (058 put Part 3 at ~480). Every slice is
  ≤ ~150 lines. Assumption: one PR, as Part 3 was agreed at 058's Gate A. If you'd rather split, slice 1 (the Budget
  card, ~65) can ship alone first, and slices 2–7 (~505) follow. Any split must ship slice 6 with or before the API
  slices (3–5), so no refusal reaches users as "Couldn’t save". The coordinator raises this with the user at Gate A.
- **Not blocking.** Budget's section head still says "€X planned" next to the card's Planned figure. Assumption: keep
  it, as 058 designed.
- **Not blocking.** The Undo bar shows `over_income` as a refusal with no Retry: within 10 s, retrying can't help
  unless someone lowers another plan. Assumption: refusal, as 058 designed.
- **Not blocking.** The card shows in every month, before 2026-11 too, red when income doesn't cover planned. The
  brief puts no month limit on what Budget shows. Assumption: show it.
- **Not blocking.** The Budget card shows only when the month has categories; an empty month keeps only the
  empty-month card. Assumption: as 058 designed.
- **Not blocking.** The message is the same for every refused path: "Planned would exceed income by €X.", including
  income cuts and the Undo bar.

## Follow-ups

- Conventions §3 proposal (carried from 058): "From 2026-11, a write that raises a month's planned total or lowers
  its income checks `checkIncome` under `lockLedger`". Also list income among what an ended month refuses.
- `lockLedger` has callers in categories and income now. `invites/routes.ts` and `historyImport.ledgerOwner` inline
  the same `FOR UPDATE`. Moving it to `ledgers/lock.ts` is a `/kopiyka-hos-refactoring` candidate (carried).

## Deviations

- Slice 1 web checks ran on the QA ledger's own November (income €5,581 against rent planned €6,000 → "−€419" in red; €419 more income on the Income tab → €0 on return), not €100/€150. October has no budget on that ledger, so "October shows its own figures" became "an empty month shows only the empty card" (October and March 2027). Web ran from this worktree's Metro on 127.0.0.1:8084 against main's API on :3000 (no API change in slice 1).

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

Re-checked against origin/main @ 2edd350 (was b4a4ae6). Since then only the app moved: `tabs.ts`, `TabBar.tsx`, the
tab bar on `category/[categoryId].tsx` and `expense.tsx`, and `expense` is no longer a modal. No API, test or deploy
file changed, and none of the files this plan edits (`budget.tsx`, `planned-amount.tsx`, `delete-category.tsx`,
`income-item.tsx`, `client.ts`) changed. Category detail still sends a removal's Undo to Home, so slice 6's checks
stand. The test lines cited (`categories.int.test.ts` 689 and 802) are unchanged. Only the Base line changed.

## Revision 2

Skeptic: approve with edits.

- Slice 3's concurrency test adds a member first (`addMember` + `authHeader`, as `income.int.test.ts` does).
  `addMember` is added to Reuses.
- The check-order tests in slices 3–5 are now real: they run on a November that is over income, and move the clock to
  1 December in Kyiv so `month_ended` must win over `over_income`. `income.int.test.ts`'s clock becomes a `let now`.
- `overIncomeText`'s well-formed `overEur` is `/^\d+\.\d{2}$/`, and the malformed test cases are checked against it.
- Slice 6's "Undo on Home" check re-seeds gym at €10 with SQL first.
- Open questions: any split keeps slice 6 with or before slices 3–5.

## Revision 3

Skeptic: approve with edits.

- Check-order tests in slices 3–5 re-login after moving the clock (`authHeader(app, owner, now)`), since sessions
  last 30 minutes on the app clock.
- Slice 6's "Income form" check re-seeds gym at €10 first.
- Slice 1 says what the card does when an income reload fails after a first load.
- `checkIncome` returns null before its SUMs for a month before the rule or a change that moves toward the limit.
- Slice 3 has a size fallback past ~170 lines. Open questions list "the card only shows with categories".

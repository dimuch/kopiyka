# Plan: Ledger income per month, and planned never above it

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/ledger-income
Base: origin/main @ 6bfa635

## Summary and split (decide at Gate A)

The whole brief comes to about 1,500 changed lines, tests included. That is too big for one PR, and the brief's
README rule is ~400 per brief. I propose three parts. Each one ships alone, in this order:

| Part | Brief                                                       | ACs                            | Est. lines |
| ---- | ----------------------------------------------------------- | ------------------------------ | ---------- |
| 1    | 058 (this one, narrowed): income items API, copy            | AC1, AC2, AC3                  | ~480       |
| 2    | 059 (proposed): Income tab in the app                       | AC8 (Income tab), AC10         | ~560       |
| 3    | 060 (proposed): the limit: Budget shows it, API enforces it | AC4–AC7, AC8 (rest), AC9, AC10 | ~480       |

- Before slice 1.1, in the same commit as this plan: `brief.md` gets a top line 'Part 1 of 3 of ledger income.
  Design: ./plan.md' and keeps only AC1–AC3 plus the gates AC. The other ACs move word for word into two new briefs.
  `docs/features/059-income-tab/brief.md` takes the Income-tab half of the app AC and of the iPhone AC, plus gates.
  `docs/features/060-income-limit/brief.md` takes AC4–AC7, the message and Budget half of the app AC, the unit-test
  AC, the message half of the iPhone AC, plus gates. Each new brief says 'plan this brief from
  ../058-ledger-income/plan.md, Part N'. 060 also says it ships only after 059 is live.
- Note for planning 059 and 060: re-slice 2.2, 2.4 and 3.4 to ≤ ~150 lines each, and move 3.2 after 3.5.

- **The order matters.** The rule (Part 3) must not ship before the Income tab (Part 2). Otherwise November, which is
  already planned with no income, would refuse every raise, and nobody could add income to fix it.
- Part 1 alone has no caller in production. That is the same as 054 (the invite API) before 055.
- Part 2 can be split again: 2a is the tab with copy (slices 2.1–2.3, ~290 lines), and 2b is the add, edit and delete
  modal (2.4–2.5, ~270 lines).
- If you'd rather have one PR, the slices below still work as one sequence on this branch.

The design below covers all three parts, so the contracts are settled once. Parts 2 and 3 can be copied into their
own briefs' plans as written.

## Approach

- **Data.** Migration 012 adds `income_items`, one row per item: ledger, month (day 1), title, `amount_eur
DECIMAL(12,2)` and `created_by`. A new domain `apps/api/src/income/routes.ts` lists, adds, edits, deletes and
  copies items under `[requireAuth, requireLedger]`. There is no owner check, so any member edits any item. Ended
  months answer `409 month_ended`, the same as planned amounts.
- **The rule** lives in `apps/api/src/income/limit.ts`:
  - a pure `overIncomeBy(month, before, after)` on bigint cents;
  - a `checkIncome(conn, ledgerId, month, delta)` that reads the month's planned and income totals and calls it.

  Each of the four write paths works out its own delta from the row it already reads, then asks `checkIncome`. When
  the answer is "over", it returns before writing anything. The four paths are `setPlanned`, `restoreToMonth` (the
  Undo for both Remove and delete; they share one route), income edit and income delete. So "writes nothing" holds
  with no rollback logic. The 409 body is `{ error: 'over_income', overEur: '12.50' }`.

- **Concurrency: the ledger row lock.** Every write that changes a month's planned total or income runs in one
  transaction, and takes `lockLedger` (`SELECT … FROM ledgers … FOR UPDATE`) as its first statement. That is every
  write to `category_budgets`, `category_months` or `income_items`. The category writes already take it. Income
  writes take it too, add included, so the argument has no exceptions. Writes for one ledger are therefore
  serialized.
  - Under InnoDB REPEATABLE READ, a transaction's snapshot starts at its first plain read. That read comes after the
    lock is granted, so `checkIncome` sees every change committed by earlier lock holders.
  - Every transaction takes the same single lock first, so they can't deadlock against each other.
  - The lock on add also protects copy's empty-month check: a concurrent add can't land between the check and the
    copy's insert.
  - This is the pattern `monthLists.ts` already uses for name checks (`nameTaken`).
- **App.** A new `(tabs)/income.tsx` tab after Budget, shaped like the Budget tab: month switcher, rows, total,
  Copy on an empty month, and "+". It adds a modal `/income-item` for add, edit and delete. `useIncome` loads a
  month's items on focus, for the Income tab, the Budget tab and the modal.
- **The Budget tab** shows Income / Planned / Left to plan. The app explains a refusal with "Planned would exceed
  income by €X." It reads `overEur` from the error body, so `ApiError` now carries the parsed body.

Alternative considered for the locking: SERIALIZABLE isolation, or `FOR UPDATE` on the summed rows. Both rely on
next-key and gap locks across `category_budgets`, `category_months` and `income_items`. Two members then deadlock
each other, and every write would need a retry loop. A per-(ledger, month) lock row would need a new table and
create-on-demand logic, for concurrency a two-person household doesn't need. The existing ledger lock is one line
per path.

Alternative considered for the check: write first, re-sum, and throw to roll back when over. That is generic, but it
turns refusals into exceptions thrown through `withTransaction`, and the routes have to catch them. Each path already
knows its delta, so computing "after" before writing is smaller.

## Contracts

- **DB, `apps/api/migrations/012_income_items.sql`.** It is re-runnable via `IF NOT EXISTS`, and the runner records
  it once.

  ```sql
  -- Brief 058. A ledger's income for a month: any number of items, from any member, EUR only. From 2026-11 a month's
  -- planned total may not exceed its income total (apps/api/src/income/limit.ts).
  CREATE TABLE IF NOT EXISTS income_items (
    income_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ledger_id     INT UNSIGNED  NOT NULL,
    income_month  DATE          NOT NULL,              -- always day 1: 2026-11-01
    title         VARCHAR(40)   NOT NULL,              -- 'Salary'; the API trims it, 1–40 characters
    amount_eur    DECIMAL(12,2) NOT NULL,              -- > 0, checked by the API
    created_by    INT UNSIGNED  NOT NULL,              -- the member who added it (or copied it in)
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (ledger_id, income_month),
    CONSTRAINT fk_income_ledger  FOREIGN KEY (ledger_id)  REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
    CONSTRAINT fk_income_creator FOREIGN KEY (created_by) REFERENCES users (user_id)
  );
  ```

  Rows are hard-deleted: there is no Undo (see Open questions). `apps/api/test/helpers.ts` `DATA_TABLES` gains
  `'income_items'`.

- **API, `apps/api/src/income/routes.ts`** (registered in `app.ts` after `categoryRoutes`).
  - Guards `[requireAuth, requireLedger]` on all routes. No session gives 401. A non-member gets 404
    `ledger_not_found`. Zod failures give 400 `invalid_request`.

  ```ts
  export interface IncomeItemDto {
    incomeId: number;
    title: string;
    /** Decimal string > 0, as stored: '2500.00'. */
    amountEur: string;
    /** Username of the member who added it; an edit by someone else doesn't change it. */
    addedBy: string;
  }
  const IncomeParams = z.object({ incomeId: z.coerce.number().int().positive() });
  // Strings only: money crosses the wire as decimal strings.
  const IncomeBody = z.object({
    title: z.string().trim().min(1).max(40),
    amount: z
      .string()
      .refine((a) => AMOUNT_RE.test(a) && toCents(a) > 0n, 'expected an amount > 0, 2 decimals at most'),
  });
  ```

  | Route                                             | Success                                        | Errors, in check order                                                                                  |
  | ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
  | `GET /api/ledgers/:id/months/:month/income`       | 200 `{ items: IncomeItemDto[] }`, oldest first | 400 bad month                                                                                           |
  | `POST /api/ledgers/:id/months/:month/income`      | 201 `IncomeItemDto`                            | 400 · 409 `month_ended`                                                                                 |
  | `PUT /api/ledgers/:id/income/:incomeId`           | 204                                            | 400 · 404 `not_found` (unknown/foreign) · 409 `month_ended` (item's month) · 409 `over_income` (Part 3) |
  | `DELETE /api/ledgers/:id/income/:incomeId`        | 204                                            | 404 `not_found` · 409 `month_ended` · 409 `over_income` (Part 3)                                        |
  | `POST /api/ledgers/:id/months/:month/income/copy` | 204                                            | 400 · 409 `month_ended` · 409 `income_exists` · 409 `no_previous_income`                                |
  - All writes run in `withTransaction`, with `lockLedger` first.
  - PUT and DELETE read the item (`WHERE income_id = ? AND ledger_id = ?`) inside the transaction, then check
    `monthEnded(income_month.slice(0, 7), now())`, then (Part 3) check `checkIncome`, then write.
  - Copy runs `INSERT … SELECT title, amount_eur … ORDER BY income_id` with `created_by` set to the caller.
  - The list is `JOIN users u ON u.user_id = i.created_by … ORDER BY i.income_id`.

- **API, `apps/api/src/categories/monthLists.ts`.**
  - `lockLedger` becomes exported. Its JSDoc says it must be the transaction's first statement.
  - Part 3 changes two return types:
    - `setPlanned(...)` returns `Promise<'set' | 'not_found' | OverIncome>` instead of `boolean`.
    - `restoreToMonth(...)` returns `Promise<'restored' | 'not_found' | 'name_taken' | OverIncome>`.
  - Their in-list SELECTs gain `COALESCE(b.planned_eur, 0) AS planned_eur` through a `LEFT JOIN category_budgets b`.
    That gives the current amount, or the one the restore brings back.
  - Check order stays the same, with the new check last:
    - PUT planned: 400 → `month_ended` → `not_found` → `over_income`.
    - Restore: `month_ended` → `not_found` → `name_taken` → `over_income`.

- **API, `apps/api/src/income/limit.ts` (Part 3):**

  ```ts
  /** The first 'YYYY-MM' month whose planned total may not exceed its income total (brief 058). */
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
   * before INCOME_RULE_START, a change that raises no planned amount and lowers no income (it moves toward the
   * limit, or changes nothing), or one that ends within income (equal is fine).
   */
  export function overIncomeBy(month: string, before: MonthTotals, after: MonthTotals): bigint;
  /**
   * Reads the month's planned total (category_budgets of live categories with a live row in the month's list) and
   * income total, applies `delta`, and returns the refusal or null. Runs inside a transaction whose first
   * statement was lockLedger.
   */
  export async function checkIncome(
    conn: PoolConnection,
    ledgerId: number,
    month: string,
    delta: MonthTotals,
  ): Promise<OverIncome | null>;
  /** The 409 body: { error: 'over_income', overEur: '12.50' }. */
  export function overIncomeError(over: OverIncome): { error: 'over_income'; overEur: string };
  ```

  - The planned sum joins `category_months` directly (`m.list_month = b.budget_month AND m.deleted_at IS NULL`)
    instead of `inMonthList`. That keeps `limit.ts` from importing `monthLists.ts`, which imports it (no cycle).
  - Sums come back as DECIMAL strings, and `toCents` turns them into bigint. Both sums are wrapped in
    `COALESCE(SUM(...), 0)`: `SUM` over no rows is NULL, and `toCents(null)` throws (`money.ts`).
  - The deltas:
    - planned: `new − current`;
    - restore: `+restored amount`;
    - income edit: `new − old`;
    - income delete: `−old`.

- **App, `apps/mobile/src/api/types.ts`:** `IncomeItem` mirrors `IncomeItemDto` with the same JSDoc.
- **App, `apps/mobile/src/api/client.ts` (Part 3):** `ApiError` gains a third field, the parsed error body:
  `readonly body: Record<string, unknown>`. `api()` passes `data` in.
- **App, `apps/mobile/src/data/`:**
  - `useIncome.ts`: `useIncome(ledgerId: number, month: string): { items: IncomeItem[] | null; error: boolean; reload: () => void }`.
    It is shaped like `useMonth`, reloads on focus, and keeps `items` through a failed refetch.
  - `income.ts`:
    - `IncomeInput = { title: string; amount: string }`;
    - `addIncome(ledgerId, month, input)`;
    - `updateIncome(ledgerId, incomeId, input)`;
    - `deleteIncome(ledgerId, incomeId)`;
    - `copyPreviousIncome(ledgerId, month)`.

    All return `Promise<void>`. Screens reload on focus.

  - `monthSummary.ts`: `incomeCents(items: IncomeItem[]): number`.
  - `monthCopy.ts`: `copyRefusedText` gains `income_exists` ("{Month} already has income.") and
    `no_previous_income` ("{Previous} has no income to copy.").
  - `overIncome.ts` (Part 3): `overIncomeText(code: string, body: Record<string, unknown>): string | null`. It returns
    "Planned would exceed income by €1,500." for `over_income`, and null for other codes. It takes plain values, so
    Node tests needn't load `client.ts`.
- **App routes and components:**
  - `(tabs)/income.tsx` is the Income tab, `/income?month=YYYY-MM`, placed after Budget in `TABS`, with a new
    `income` icon.
  - `app/income-item.tsx` is a modal: `/income-item?month=YYYY-MM` adds, and `&incomeId=N` edits or deletes. It is
    registered in `_layout.tsx` with `presentation: 'modal'`. Edit finds the item in `useIncome(ledgerId, month)`, so
    no GET-one route is needed.
  - `components/NoBudget.tsx` becomes `components/EmptyMonth.tsx`, with props `{ text: string; action?; note? }`. It
    has three callers: Budget, Expenses and Income.
- **Reuses:**
  - API: `lockLedger`, `withTransaction`, `AMOUNT_RE`, `toCents`, `centsToString`, `monthEnded`,
    `previousMonthStart`, `MONTH_RE`.
  - App: `normalizeAmount` (> 0, comma as the decimal mark), `eur`, `toCents`, `plannedCents`, `monthEndedText`,
    `copyRefusedText`, `MonthSwitcher`, `HomeButton`, `LoadError`, `parseIdParam`, `parseMonthParam`, `kyivMonth`,
    `shiftMonth`, `usePushOnce`, `dangerText`.
- **New dependencies:** none.

## Slices

### Part 1: income items API (this branch)

- [x] 1.1 List a month's income items (~120)
  - Files: `apps/api/migrations/012_income_items.sql`, `apps/api/src/income/routes.ts`, `apps/api/src/app.ts`,
    `apps/api/test/helpers.ts`, `apps/api/test/income.int.test.ts`.
  - Change: the migration, `IncomeItemDto`, `toDto`, and the GET (Contracts).
  - Tests, in `income.int.test.ts`, with the clock at 2026-10-06 and items inserted with raw SQL:
    - lists items oldest first, each with `addedBy`;
    - an empty month answers `{ items: [] }`;
    - the stranger ledger's items never show;
    - `2026-13` gives 400;
    - no session gives 401;
    - a non-member gets 404 `ledger_not_found`.
- [x] 1.2 Add an income item to a month (~120)
  - Files: `income/routes.ts` (`IncomeBody`, POST), `categories/monthLists.ts` (export `lockLedger`), the test file.
  - Tests:
    - the owner adds `'  Salary '`/`'2500'` → 201 `{ title: 'Salary', amountEur: '2500.00', addedBy: owner }`;
    - a second member (via `addMember`) adds `'300.5'` → `'300.50'`;
    - a 40-character title is accepted;
    - 400 `invalid_request`, with the count unchanged, for each of these:
      - title `''`, `'   '`, 41 characters, or missing;
      - amount `'0'`, `'0.00'`, `'-1'`, `'1.234'`, `'abc'`, `''`, `'123456789'`, `2500`, `null`, or missing;
    - 409 `month_ended` for 2026-09;
    - 401;
    - non-member 404.
- [x] 1.3 Let any member edit an income item (~95)
  - Files: `income/routes.ts` (`IncomeParams`, PUT in a transaction), the test file.
  - Tests:
    - a member edits the owner's item → 204; the list shows the new title and amount, and `addedBy` is still the
      owner;
    - the same invalid bodies → 400, item unchanged;
    - 404 for id 999999, for the stranger's item on my ledger's URL, and for a deleted item;
    - an id of `abc` → 400;
    - 409 `month_ended` for a September item (raw SQL), unchanged;
    - 401;
    - non-member 404.
- [x] 1.4 Let any member delete an income item (~75)
  - Files: `income/routes.ts` (DELETE), the test file.
  - Tests:
    - a member deletes the owner's item → 204, and it's gone from the list;
    - a second DELETE → 404;
    - an id of `abc` → 400;
    - the stranger's item → 404, still there;
    - September → 409 `month_ended`, still there;
    - 401;
    - non-member 404.
- [x] 1.5 Copy last month's income into an empty month (~95)
  - Files: `income/routes.ts` (copy), the test file.
  - Tests:
    - October has Salary 2500 (owner) and Freelance 300 (member). The member copies into November → 204.
      November has both titles and amounts in order, with `addedBy` set to the member, and October is unchanged;
    - November already has an item → 409 `income_exists`, nothing written;
    - October has no items → 409 `no_previous_income`;
    - the stranger ledger's October items are never copied: my November gets only my October's items, and with my
      October empty the copy answers 409 `no_previous_income`;
    - 2026-09 → 409 `month_ended`;
    - `2026-13` → 400;
    - 401;
    - non-member 404;
    - two copies at once → status codes, sorted, equal `[204, 409]`, and one set is written.

### Part 2: Income tab (proposed brief 059)

- [ ] 2.1 Let the empty-month card say what the month lacks (~25)
  - Files: `git mv components/NoBudget.tsx components/EmptyMonth.tsx`, `(tabs)/budget.tsx`, `(tabs)/expenses.tsx`.
  - Change: `month` → `text`. Callers pass `No budget for ${monthName(month)} yet`. This is behaviour-preserving.
  - Verify: Budget and Expenses on an empty month look the same as before (web 390×844); typecheck, lint.
- [ ] 2.2 Show a month's income on a new Income tab (~210)
  - Files: `api/types.ts`, `data/useIncome.ts`, `data/monthSummary.ts`, `components/Icon.tsx` (`income`:
    `['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14']`), `(tabs)/_layout.tsx`, `(tabs)/income.tsx`,
    `test/monthSummary.test.ts`.
  - Change: the tab, laid out like Budget:
    - a header with `HomeButton` and `MonthSwitcher` (month in the route);
    - loading, error with Retry, and refresh-error states;
    - a section head "Income" with "€X total" from `incomeCents`;
    - rows showing the title, "Added by {username}" and the amount;
    - an empty month shows `EmptyMonth` "No income for {Month} yet".
  - Tests: `incomeCents` sums `'2500.00'`, `'300.50'` and `'0.01'` to 280051, and `[]` to 0.
  - Verify (web 390×844, light and dark):
    - six tab icons fit, and Income sits after Budget;
    - seeded items show with their totals;
    - switching months works;
    - an API stopped mid-session shows Retry.
- [ ] 2.3 Copy last month's income on an empty Income tab (~55)
  - Files: `data/income.ts` (`copyPreviousIncome`), `data/monthCopy.ts`, `test/monthCopy.test.ts`,
    `(tabs)/income.tsx`.
  - Change: "Copy {Previous}’s income" appears when the month isn't ended and the previous month's `useIncome` has
    items. It has an in-flight guard, and refusal and failure notes like Budget's copy.
  - Tests: `copyRefusedText` rows for `income_exists` and `no_previous_income`.
  - Verify: an empty November with October items → Copy → both items appear with their amounts.
- [ ] 2.4 Add an income item from the Income tab (~190)
  - Files: `data/income.ts` (`addIncome`), `app/income-item.tsx`, `app/_layout.tsx`, `(tabs)/income.tsx` ("+").
  - Change: the modal.
    - Fields: Title (`maxLength={40}`) and Amount (€ prefix, `decimal-pad`), both labelled. Save is guarded by
      `inFlight`.
    - Client checks: an empty title gives "Enter a title."; `normalizeAmount` null gives "Enter an amount in euros
      above 0, like 2500 or 2500.50."
    - `month_ended` → `monthEndedText`, with no Save. Any other failure → "Couldn’t save. Check your connection and
      try again."
    - It closes with `router.back()`, or `router.replace('/income?month=')` when opened from a link.
    - The tab's "+" appears only for a month that is loaded and not ended.
  - Verify:
    - add Salary 2500 to November, and it shows with the total and "Added by claude-qa";
    - `0` and `abc` show the hint;
    - a bad link shows "That link isn’t valid.".
- [ ] 2.5 Edit and delete an income item (~80)
  - Files: `data/income.ts` (`updateIncome`, `deleteIncome`), `app/income-item.tsx`, `(tabs)/income.tsx`.
  - Change: rows in a month that isn't ended become buttons, labelled "{title}, €X, added by {name}", that open the
    modal with `incomeId`.
    - The modal is pre-filled from `useIncome`. While loading it shows a spinner; on error it shows LoadError with
      Retry; an item not in the list shows "This income item isn’t in {Month} any more.".
    - "Delete item" (`dangerText`) deletes at once and closes.
    - `not_found` on save or delete shows the same line, with no Save.
  - Verify: change the title and amount and the total updates; Delete removes the item; an ended month's rows aren't
    buttons.

### Part 3: the limit (proposed brief 060)

- [ ] 3.1 Show income, planned and left to plan on the Budget tab (~60)
  - Files: `(tabs)/budget.tsx`.
  - Change: above the Categories section of a month with categories, a card shows three figures:
    - Income, from `useIncome` → `incomeCents`;
    - Planned, from `plannedCents`;
    - Left to plan, which is income − planned in `colors.danger` when below 0.

    It is hidden while income loads. An income error shows LoadError "Couldn’t load {Month}’s income…" with Retry.

  - Verify: November with €100 income and €150 planned shows "Left to plan −€50" in red. October shows its figures.
    Adding income on the Income tab updates Budget on return.
- [ ] 3.2 Explain an over-income refusal in the app (~70)
  - Files: `api/client.ts` (`ApiError.body`), `data/overIncome.ts`, `test/overIncome.test.ts`,
    `app/planned-amount.tsx`, `app/delete-category.tsx` (`refusedText`), `app/income-item.tsx`.
  - Change: each screen tries `overIncomeText(err.code, err.body)` before its existing texts. The editor stays
    editable, so a smaller amount can be saved. The Undo bar shows the line as a refusal, with no Retry.
  - Tests:
    - `over_income` with `{ overEur: '12.50' }` gives "Planned would exceed income by €12.50.";
    - `'1500.00'` gives "€1,500";
    - a missing or non-string `overEur` gives "Planned would exceed income.";
    - `month_ended` and `not_found` give null.
  - Verify: done after 3.4 and 3.5, in the PR's test plan, because no server sends the code before them.
- [ ] 3.3 Add the over-income rule's arithmetic (~90)
  - Files: `apps/api/src/income/limit.ts` (`INCOME_RULE_START`, `MonthTotals`, `OverIncome`, `overIncomeBy`,
    `overIncomeError`), `apps/api/test/incomeLimit.test.ts`.
  - Tests, a table in cents, each comment giving the sum:
    - 2026-11, (0, 10000) → (10000, 10000): 0n. Equal is allowed.
    - (0, 10000) → (10001, 10000): 1n.
    - Over (15000, 10000):
      - lowering planned to 14000: 0n;
      - raising income to 12000: 0n;
      - unchanged: 0n (a title-only edit);
      - raising planned to 15050: 5050n;
      - lowering income to 9000: 6000n.
    - (5000, 10000) → income 4000: 1000n. Income 5000: 0n.
    - 2026-10, (0, 0) → (9999999999, 0): 0n. 2027-01 is checked.
    - 15 × 99,999,999.99 planned against 0 income: 149999999985n, exactly.
    - `overIncomeError({ overCents: 1n })` gives `{ error: 'over_income', overEur: '0.01' }`.
- [ ] 3.4 Refuse raising planned above income, including the Undo of a removal (~170)
  - Files: `income/limit.ts` (`checkIncome`), `categories/monthLists.ts` (`setPlanned`, `restoreToMonth`),
    `categories/routes.ts`, `apps/api/test/income.int.test.ts` (`describe('over-income rule')`),
    `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. Two existing tests plan November with no income, at `categories.int.test.ts` around
    lines 689 and 802. They insert a November income item first, so they keep their meaning.
  - Tests, all in November unless noted, checking the DB after each refusal:
    - Planned raises:
      - with €100 income, rent → '100' gives 204 (equal);
      - then groceries → '0.01' gives 409 `{ error: 'over_income', overEur: '0.01' }`, and groceries has no
        `category_budgets` row.
    - Already over: rent 150 and groceries 50 planned with raw SQL, no income.
      - rent → 120 gives 204;
      - rent → 120 again gives 204 (unchanged);
      - rent → 121 gives 409 `overEur: '171.00'`;
      - removing groceries gives 204;
      - adding €10 income gives 201.
    - Undo of a removal:
      - €100 income, rent 80, remove rent, groceries → 50;
      - restoring rent gives 409 `overEur: '30.00'`; rent is still out of the list, with its stamp unchanged;
      - groceries → 20, then restoring rent gives 204, and rent comes back at '80.00';
      - restoring a €0 category in an over month gives 204.
    - Before the rule: October rent → 500 with no income gives 204.
    - Concurrency: €60 income, and six different categories → '20' at once (`Promise.all`). Exactly three get 204
      and three get 409, and the planned sum ends at '60.00'.
- [ ] 3.5 Refuse lowering or deleting income below planned (~90)
  - Files: `income/routes.ts` (PUT and DELETE call `checkIncome`), `income.int.test.ts`.
  - Tests, starting from items A 60 and B 40, with rent planned at 100:
    - A → 59.99 gives 409 `overEur: '0.01'`, and A is unchanged;
    - A's title change at '60' gives 204;
    - A → 70 gives 204, then A → 60 gives 204;
    - DELETE B gives 409 `overEur: '40.00'`, and B stays;
    - rent → 60, then DELETE B gives 204;
    - in October, deleting the only item below planned gives 204.
    - Concurrency:
      - six €20 items, rent 60, six DELETEs at once: three 204, three 409, and income ends at '60.00';
      - items 50 + 50 and rent 50, with groceries → 50 and DELETE of one item at once: one 204, one 409, and
        planned ≤ income afterwards.

## AC → evidence

| AC                                                              | Evidence                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API list/add/edit/delete, 400/404/409/401/non-member            | `income.int.test.ts` cases in 1.1–1.4                                                                                                                                                     |
| Any member edits and deletes                                    | 1.3 "a member edits the owner's item", 1.4 "a member deletes the owner's item"                                                                                                            |
| Copy keeps titles and amounts; refused when items/no previous   | 1.5 cases                                                                                                                                                                                 |
| 409 `over_income` and writes nothing; equal allowed (≥ 2026-11) | 3.4 (planned, restore), 3.5 (income edit, delete), each checking the DB after a refusal                                                                                                   |
| Lowering, removing, adding income succeed when already over     | 3.4 "already over" case                                                                                                                                                                   |
| A month before 2026-11 accepts planned above income             | 3.3 table row, 3.4 October case, 3.5 October delete                                                                                                                                       |
| Holds under concurrent writes                                   | 3.4 and 3.5 concurrency cases. Prove-It: with `lockLedger` dropped from `setPlanned`, the 3.4 case lets more than three through (developer checks once and records it in Deviations)      |
| App: Income tab, message, Budget figures (web 390×844)          | Manual checks in 2.2–2.5 and 3.1; the message on PUT planned, Undo of a removal, and income edit/delete after 3.5                                                                         |
| Unit tests: amount parsing and rule arithmetic (cents)          | `incomeLimit.test.ts` (3.3); the form reuses `normalizeAmount` (`format.test.ts`) and the API reuses `AMOUNT_RE`/`toCents` (`money.test.ts`); `incomeCents` (2.2), `overIncomeText` (3.2) |
| iPhone (Expo Go): Income tab and the message                    | The user checks this in the Part 2 and Part 3 PRs                                                                                                                                         |
| Gates green, integration tests ran                              | Every slice; `DATABASE_URL_TEST` exported in the worktree                                                                                                                                 |

## Not doing (YAGNI)

- A GET-one income route. The modal reads the month's list.
- Undo or soft delete for income items.
- Currencies other than EUR, recurring income, received vs expected income, comparing with expenses, and Notion
  sync. All are out of scope in the brief.
- A "left to plan" hint inside the planned-amount editor before saving.
- The Budget figures card on a month with no categories. That month shows the empty-month card, as today.
- The month carrying over between the Budget and Income tabs. Each tab keeps its own `?month=`.
- A rule check in the Notion history import. It only imports January–October 2026, before the rule, and it already
  takes the ledger lock.
- A per-month lock row, SERIALIZABLE isolation, or retry loops.
- Changes to Home or Statistics.

## Risks

- **A writer that skips the ledger lock**, or a plain read before it, would let a race through. Today every writer of
  `category_budgets`, `category_months` and `income_items` takes the lock first: the six `monthLists.ts` functions,
  `historyImport.importMonth`, and the new income routes.
  - The concurrency tests in 3.4 and 3.5 check this.
  - The Prove-It run (lock removed → test fails) shows the tests can catch a race.
  - If the race won't reproduce under `app.inject`, the developer records that in Deviations and raises the
    parallelism. Six is below the pool's 10.
- **Existing November planning tests break under the rule.** Slice 3.4 updates them and proves it.
- **Production:** November is already planned with no income. Once Part 3 deploys, it refuses raises until income is
  added. The brief intends this, and Part 2 must be live first (Summary).
- **Six tab icons at 390pt** might crowd the bar. Slice 2.2 checks it on web and iPhone.
- **Sums as DECIMAL strings into `toCents`** (`'0.00'` and large values). Exact `overEur` values in 3.4 and 3.5, and
  the 15 × max row in 3.3, prove it.

## Open questions

- **Resolved:** split the brief into three parts and briefs (058, 059, 060), with this branch building Part 1 only?
  Split decided by the user.
- **Not blocking:** an income item deletes at once from its edit modal, with no confirm and no Undo. Two deliberate
  taps are already needed: open the item, then Delete. The alternatives are a second inline tap like Members' Remove
  (~+40, by extracting `ConfirmPanel`), or soft delete with an Undo bar (~+90).
- **Not blocking:** the title is 1–40 characters after trimming, like category names.
- **Not blocking:** copied items show as added by the member who copied them.
- **Not blocking:** the 409 body carries `overEur` next to `error`. The conventions say `{ error }`; Zod's 400
  already adds `issues`. The message reads "Planned would exceed income by €X." for every refused path, including
  income cuts and the Undo bar.
- **Not blocking:** check order. A restore checks `name_taken` before `over_income`; PUT planned checks `not_found`
  before `over_income`.
- **Not blocking:** tab order is Home, Budget, Income, Expenses, Statistics, Settings, and the income icon is an arrow
  into a tray.

## Follow-ups

- Conventions §3 proposal: add the invariant "From 2026-11, a write that raises a month's planned total or lowers its
  income checks `checkIncome` under `lockLedger`". Also list income among what an ended month refuses.
- `lockLedger` now has callers in categories and income. `invites/routes.ts` and `historyImport.ledgerOwner` inline
  the same `FOR UPDATE`. Moving it to `ledgers/lock.ts` is a candidate for `/kopiyka-hos-refactoring`.

## Deviations

<filled by the developer during build>

## Consolidate

Pass over `origin/main...HEAD` (Part 1). Reused 1 · extracted 0 · left 4.

- `lockLedger` — REUSE: exported from `categories/monthLists.ts` and called by every income write (slice 1.2).
- `AMOUNT_RE`, `toCents`, `centsToString`, `MONTH_RE`, `monthEnded`, `previousMonthStart`, `withTransaction` — already
  called, nothing re-implemented.
- `refuseChange` / `sendRefusal` — the PUT and DELETE copies of "find the item, refuse an ended month" were merged in
  slice 1.4, so the branch has one.
- `MonthParams`, `IncomeParams`, `IncomeBody` — LEAVE: Zod params and bodies are per domain by convention
  (`ExpenseParams`, `InviteParams`, categories' `Month`); none is exported to share.
- `toDto` — LEAVE: each domain maps its own rows to its DTO.
- Copy route vs `copyPreviousMonth` — LEAVE: different rules (categories with amounts reset to €0 and month lists,
  versus income rows copied with amounts); merging them would change behaviour.
- Inline `409 month_ended` replies — LEAVE: the same one-line pattern every month route uses.

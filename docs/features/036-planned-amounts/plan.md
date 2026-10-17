# Plan: Planned amount per category per month (part 3 of 5 of 033)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (outline: ../033-monthly-budget/plan.md, "Later parts", Part 3)
Branch: feat/planned-amounts
Base: origin/main @ 52d781a (parts 1 and 2, PRs #45 and #46, merged)

## Approach

`category_budgets (category_id, budget_month, planned_eur DECIMAL(12,2) DEFAULT 0, updated_at)` has existed since 001
and nothing uses it, so no migration is needed.

- **Read.** Both category reads `LEFT JOIN category_budgets` on the asked month: the month's list
  (`GET …/categories?month=`) and one category (`GET …/categories/:categoryId?month=`). `CategoryDto` gains
  `plannedEur`, which is `'0.00'` when no row is stored. 034 reads the list through `useMonth`. The new editor reads
  one category through `useCategoryTotals`, the same way `delete-category.tsx` does.
- **Write.** `PUT …/categories/:categoryId/months/:month/planned` upserts the row. It runs in
  `monthLists.ts::setPlanned`, under the same `lockLedger` and in-list check as `removeFromMonth`, so a concurrent
  copy can't leave a stale amount behind.
- **Copy** also deletes the month's `category_budgets` rows, so a copy starts at €0. Rows can only exist there for
  categories removed earlier, because Remove keeps amounts.
- **Remove and Undo** don't touch `category_budgets`, so Undo brings the amount back with no code change. A test
  proves it.
- **App.** Budget rows show `plannedEur`, and the section head shows the month's total in cents. Outside an ended
  month, a row opens a new `/planned-amount` modal. The modal loads the category with `useCategoryTotals`, parses the
  input with `format.ts::normalizePlanned` (≥ 0), and sends the PUT. On success it goes back, and the Budget tab's
  `useMonth` reloads on focus.

Alternative considered: put `plannedEur` only on the list rows (`MonthCategoryDto`) and pass the name and amount to the
modal as route params. It needs about 30 fewer lines (no loader in the modal), but a web link or refresh would show
whatever the URL says. Every other modal here loads by id, so this lost.

## Contracts

- **DB:** none. The table is `category_budgets` (001). `PRIMARY KEY (category_id, budget_month)` makes the upsert
  `ON DUPLICATE KEY`. `budget_month` is always day 1 (`'2026-10-01'`).
- **API, `apps/api/src/categories/routes.ts`:**
  - `CategoryDto` gains:
    ```ts
    /** The month's planned EUR (brief 036): a decimal string ≥ 0, '0.00' when none is set. */
    plannedEur: string;
    ```
    `toDto` maps `planned_eur`. `CategoryWithTotalsDto` inherits the field.
  - List SQL: add `COALESCE(b.planned_eur, 0) AS planned_eur` and
    `LEFT JOIN category_budgets b ON b.category_id = c.category_id AND b.budget_month = ?` before the `u` join. The
    params become `[first, ledgerId, first]`.
  - GET one SQL: add the same column and join, placed before the expenses join. The params become
    `[first /* in_month */, first /* b */, first, next, categoryId, ledgerId]`. A category removed from that month
    (`inMonth: false`) still reports its stored amount, which is the one Undo brings back. `COALESCE(DECIMAL(12,2), 0)`
    returns `'0.00'` (checked on the test DB).
  - New body schema:
    `const PlannedBody = z.object({ amount: z.string().regex(AMOUNT_RE, 'expected an amount ≥ 0 with at most 2 decimals') })`.
    It accepts strings only, because money crosses the wire as decimal strings. `AMOUNT_RE` (`money.ts`) already
    accepts `'0'` and rejects `'-1'`, `'1.234'` and `'123456789'`.
  - **`PUT /api/ledgers/:id/categories/:categoryId/months/:month/planned`**, body `{ "amount": "120.50" }`. Guards:
    `requireAuth`, `requireLedger`. Steps, in order:
    1. `MonthParams.parse(req.params)` and `PlannedBody.parse(req.body)`: either failing gives 400
       `invalid_request`.
    2. `monthEnded(month, now())` gives 409 `month_ended`, before anything is read.
    3. `setPlanned(…)` returns false → 404 `not_found`.
    4. Otherwise 204.

    No session gives 401, and a non-member gives 404 (the guards).
- **API, `apps/api/src/categories/monthLists.ts`:**

  ```ts
  /**
   * Sets a category's planned EUR ('12.50', ≥ 0) for a 'YYYY-MM' month (brief 036). False, writing nothing, when the
   * category isn't in the month's list (unknown, foreign, deleted, removed, or the month has no budget).
   */
  export async function setPlanned(
    db: Db,
    ledgerId: number,
    categoryId: number,
    month: string,
    amount: string,
  ): Promise<boolean>;
  ```

  It works inside `withTransaction`:
  1. `lockLedger`.
  2. The same `SELECT 1 … AND ${inMonthList('?')}` check as `removeFromMonth`.
  3. `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE planned_eur = ?`.

  `copyPreviousMonth` gains one statement after its `category_months` delete:
  `DELETE b FROM category_budgets b JOIN categories c ON c.category_id = b.category_id WHERE c.ledger_id = ? AND b.budget_month = ?`.
  Its JSDoc and the file's header comment add brief 036.

- **App, `apps/mobile/src/api/types.ts`:** `Category` gains the same `plannedEur: string` with the same JSDoc.
  `CategoryWithTotals` inherits it.
- **App, `apps/mobile/src/format.ts`:**
  ```ts
  /** Typed planned amount → '12.50'-style string the API accepts, or null; €0 is a plan. A comma works as the decimal mark. */
  export function normalizePlanned(text: string): string | null;
  ```
  It takes over `normalizeAmount`'s current body without the `> 0` check. `normalizeAmount` becomes
  `const v = normalizePlanned(text); return v && toCents(v) > 0 ? v : null;`, so its behaviour and tests stay as
  they are.
- **App, `apps/mobile/src/data/categories.ts`:**
  ```ts
  /** Sets a category's planned EUR ('12.50', ≥ 0) for a 'YYYY-MM' month. */
  export async function setPlanned(ledgerId: number, categoryId: number, month: string, amount: string): Promise<void>;
  // PUT /api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}/planned  body { amount }
  ```
- **App route `/planned-amount?categoryId=<id>&month=YYYY-MM`** (`apps/mobile/src/app/planned-amount.tsx`), registered
  in `_layout.tsx` as `presentation: 'modal'`. Params are checked with `parseIdParam` and `parseMonthParam`; a bad
  link shows "That link isn’t valid.".
- **Consumers:**
  - Budget tab (this brief).
  - 034: the Expenses tab's rows and total, and Home's Budget card. Both read `useMonth(…).data.categories[i].plannedEur`.
    No other change is needed for them.
- **New dependencies:** none.

## Slices

- [x] 1. List each category's planned amount for the month
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`.
  - Change: `plannedEur` on `CategoryDto`, plus the `LEFT JOIN` in the list and GET-one SQL (Contracts). About 30
    lines.
  - Tests, in `categories.int.test.ts`, one new case: "gives each category its planned amount for the month, €0
    without one". It inserts rent at `'120.50'` for 2026-10 and `'99.00'` for 2026-09 with raw SQL, then checks:
    - list 2026-10: rent `'120.50'`, every other row `'0.00'`;
    - list 2026-09: rent `'99.00'`;
    - GET one rent `?month=2026-10`: `plannedEur: '120.50'`, `expenseCount` unchanged at 0;
    - GET one rent `?month=2026-12` (no budget): `'0.00'` and `inMonth: false`.

    The existing `toMatchObject` assertions are unaffected.

- [x] 2. Set a category's planned amount for a month
  - Files: `apps/api/src/categories/monthLists.ts` (`setPlanned`), `apps/api/src/categories/routes.ts`
    (`PlannedBody`, the PUT), `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. About 110 lines, 75 of them tests.
  - Tests, a new `describe('planned amounts')` with a helper
    `plan(categoryId, headers = auth, ledgerId = owner.ledgerId, month = '2026-10', amount: unknown = '120.50')`, so
    it fits the guards table below. Cases:
    - "sets and replaces the amount for that month only": PUT rent `'120.50'` → 204, and the list shows `'120.50'`.
      PUT `'0'` → `'0.00'`. PUT `'99999999.99'` → that value. The 2026-09 list's rent stays `'0.00'`. After
      `storeMonthList(db, ledger, '2026-11', [])`, a PUT for 2026-11 changes neither October's nor November's other
      rows.
    - "rejects a negative or malformed amount, changing nothing": each of `'-1'`, `'-0.01'`, `'1.234'`, `'abc'`,
      `''`, `'123456789'`, `120` (a number) and `null`, plus a request with no body, gives 400 `invalid_request`.
      `SELECT COUNT(*) FROM category_budgets` stays 0. A malformed month (`'2026-13'`) also gives 400.
    - "answers 404 for a category not in that month's list, changing nothing": each gives 404 `not_found` and the
      count stays 0:
      - eating out removed from 2026-10 (via `removeFrom`);
      - any category in 2026-12 (no budget);
      - a category with `categories.deleted_at` set;
      - id 999999;
      - the stranger ledger's rent sent on my ledger's URL.
    - "refuses a month that has ended in Kyiv, changing nothing": PUT 2026-09 (in the list, clock 2026-10-06) gives
      409 `month_ended`, and the count stays 0.
    - "keeps the amount through Remove and Undo": PUT gym `'50.00'`, then `removeFrom(gym)`: the list lacks gym. Then
      `restoreTo(gym)`: the list shows gym `'50.00'`.
    - Guards: add `['set planned amount', plan]` to the existing `describe.each` guards table. That covers 401, the
      non-member 404, and 400 for a non-numeric id.

- [x] 3. Start a copied month's planned amounts at €0
  - Files: `apps/api/src/categories/monthLists.ts` (`copyPreviousMonth`), `apps/api/test/categories.int.test.ts`.
  - Change: one `DELETE b …` after the `category_months` delete, and the JSDoc says amounts go too. About 12 lines.
  - Tests:
    - Extend "sets up a month with the previous month's list, in its order": PUT October rent `'120.00'` first. After
      the copy, every November row is `'0.00'` and October's rent stays `'120.00'`.
    - Extend "starts a month whose categories were all removed afresh": PUT November gym `'15.00'` before the rows are
      stamped. After the copy, November's gym is `'0.00'`. This assertion fails without the `DELETE` (Prove-It).

- [x] 4. Show planned amounts and the month's total on the Budget tab
  - Files: `apps/mobile/src/api/types.ts`, `apps/mobile/test/quick.test.ts` (the fixture gains
    `plannedEur: '0.00'`), `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change: the section head becomes a row: "Categories" on the left, `` `${eur(plannedTotal)} planned` `` on the
    right, styled like the Expenses tab's `sectionHead` and `small`. `plannedTotal` is
    `data.categories.reduce((s, c) => s + toCents(c.plannedEur), 0)`, computed inline because it has one caller. Each
    row's name gets `flex: 1`, and `eur(toCents(c.plannedEur))` sits on the right (`rowAmount` style, tabular nums).
    The rows stay non-pressable in this slice. About 30 lines.
  - Verify: on web at 390×844 as `claude-qa-036`, October shows 15 rows at €0 and "€0 planned". Then set two amounts
    for the QA ledger only with SQL: `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES
(<rent>, '2026-10-01', 120.50), (<gym>, '2026-10-01', 40)`. Reload: rent shows €120.50, gym €40, and the head
    "€160.50 planned". Check light and dark.

- [x] 5. Parse a typed planned amount, allowing €0
  - Files: `apps/mobile/src/format.ts`, `apps/mobile/test/format.test.ts`.
  - Change: `normalizePlanned`, with `normalizeAmount` built on it (Contracts). About 30 lines.
  - Tests, a new case "normalizes typed planned amounts, allowing €0", table style:
    - accepted: `'0'`→`'0.00'`, `'0.00'`→`'0.00'`, `'120'`→`'120.00'`, `'12,5'`→`'12.50'`, `' 7 '`→`'7.00'`,
      `'007.5'`→`'7.50'`, `'12.'`→`'12.00'`, `'99999999.99'`→same;
    - null: `'-1'`, `'-0'`, `'1.234'`, `'123456789'`, `'abc'`, `''`, `'.5'`, `'1,5,0'`.

    The existing `normalizeAmount` case, which rejects `'0'` and `'0.00'`, stays and guards the refactor.

- [x] 6a. Set a category's planned amount in a modal opened by link
  - Files: `apps/mobile/src/app/planned-amount.tsx` (new), `apps/mobile/src/app/_layout.tsx` (one
    `Stack.Screen name="planned-amount"` with `presentation: 'modal'`), `apps/mobile/src/data/categories.ts`
    (`setPlanned`).
  - Change, `planned-amount.tsx`. It copies `delete-category.tsx`'s shape:
    - **Header:** Cancel, the title "Planned amount", and a spacer.
      - `busy` lives in the screen and is passed down, as in `delete-category.tsx`.
      - Cancel is `disabled={busy}`, and the screen renders `<Stack.Screen options={{ gestureEnabled: !busy }} />`
        (`delete-category.tsx:36-38`). A swipe or a Cancel press during the PUT can't then trigger a second
        `router.back()`.
      - `leave()` does `router.back()` when there's history. Otherwise it does
        `router.replace(month ? { pathname: '/budget', params: { month } } : '/budget')`.
    - **Loader:** `useCategoryTotals`, with the same loading and error states. `not_found` gives "Category not
      found."; any other error gives a Retry. `!inMonth` gives `“rent” isn’t in October.`.
    - **Editor:**
      - The heading is the category name, with "Planned for October" under it.
      - The labelled `TextInput` (`accessibilityLabel="Planned amount in EUR"`, € prefix, `keyboardType="decimal-pad"`,
        `autoFocus`, `selectTextOnFocus`, `onSubmitEditing={save}`) starts at `category.plannedEur`.
      - Save is a button of at least 44pt with a busy spinner. An `inFlight` ref guards it.
    - **Save:**
      - `normalizePlanned(text)` null → "Enter an amount in euros, like 120 or 120.50." No request is sent.
      - Otherwise `setPlanned`, then `leave()`.
      - `409 month_ended` → "October has ended, so it can’t change.", and `404 not_found` →
        `“rent” isn’t in October any more.`. Both hide Save, because trying again can't help.
      - Anything else → "Couldn’t save. Check your connection and try again."
      - Errors use `accessibilityRole="alert"` and `AccessibilityInfo.announceForAccessibility`.
    - Styles use `makeStyles(colors)` and theme tokens only.

    About 180 lines. The screen can't usefully be split further.

  - Verify: on web at 390×844, open `/planned-amount?categoryId=<rent>&month=2026-10` directly.
    - It starts at the stored value. Save `120,5`: with no history it lands on `/budget?month=2026-10`, and rent shows
      €120.50.
    - `-5` shows the inline message, with no PUT in the network panel.
    - `?categoryId=abc` gives "That link isn’t valid.".
    - The ended-month link check in AC row 3 also applies.
    - While a save is in flight (throttle the network), Cancel is disabled.

- [ ] 6b. Open the planned amount editor from a Budget row
  - Files: `apps/mobile/src/app/(tabs)/budget.tsx`.
  - Change:
    - When `!ended`, each row is a `Pressable`, `accessibilityRole="button"`,
      ``accessibilityLabel={`${name}, ${eur(cents)} planned`}`` and `accessibilityHint="Sets the planned amount"`.
      It opens `router.push({ pathname: '/planned-amount', params: { categoryId, month } })`.
    - An ended month keeps a plain `View`, so it has no edit control.

    About 20 lines.

  - Verify: AC rows 3 and 4 (the tap flow, the Budget tab refreshing after the modal closes, and ended-month rows).

Estimated total: about 410 changed lines (API about 150, of which about 105 are tests; app about 260). That is just over the ~400 limit, which slice 6a explains.

## AC → evidence

QA setup (local dev DB, QA ledger only):

1. `yarn api create-user --username claude-qa-036 --email claude-qa-036@example.test`. Its October (the Kyiv month
   of creation) has the 15 defaults, and other months are empty.
2. For the ended-month check, add a September list to that ledger only:
   `INSERT INTO category_months (category_id, list_month) SELECT category_id, '2026-09-01' FROM categories WHERE ledger_id = <qa>`.
3. The running API must be this checkout's. Check with `lsof -iTCP:3000 -sTCP:LISTEN` and the process's cwd.

Delete the QA user and ledger after the PR.

| AC                                                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. API: set an amount (happy, 400, 404 not in list, 409, 401, non-member 404); the list returns `plannedEur` | `categories.int.test.ts`: slice 1's case (list and GET one), slice 2's `planned amounts` cases, and the `set planned amount guards` row of the guards table.                                                                                                                                                                                                                                                                                                                             |
| 2. API: a copy starts at €0; Remove then Undo keeps the amount                                               | Slice 3's two extended copy cases (the second is the Prove-It); slice 2's "keeps the amount through Remove and Undo".                                                                                                                                                                                                                                                                                                                                                                    |
| 3. App web 390×844: setting an amount updates the row and the planned total                                  | Budget → October → tap rent → enter `120,5` → Save. The modal closes, the row shows €120.50, and the head goes up by that amount. Reopen rent: it starts at `120.50`. Enter `0`: the row shows €0. Enter `-5` or `1.234`: the inline message shows and no PUT appears in the network panel. Budget → Next → Copy October's categories: November's rows are all €0 and "€0 planned". Open `/planned-amount?categoryId=abc&month=2026-10`: "That link isn’t valid.". Check light and dark. |
| 3. App: an ended month can't edit                                                                            | With the QA September seed: Budget → September shows amounts with no row buttons (tapping does nothing; no button role in the accessibility tree). Open `/planned-amount?categoryId=<rent>&month=2026-09` directly and press Save: "September has ended, so it can’t change." and Save disappears.                                                                                                                                                                                       |
| 4. Unit tests for the amount parsing                                                                         | `apps/mobile/test/format.test.ts` → "normalizes typed planned amounts, allowing €0", plus the existing `normalizeAmount` case.                                                                                                                                                                                                                                                                                                                                                           |
| 5. iPhone (Expo Go): the editor works                                                                        | The user, on iPhone: Budget → tap a row → the decimal pad opens with the value selected → enter an amount → Save. The row and total update. Swipe the modal down without saving: nothing changes.                                                                                                                                                                                                                                                                                        |
| 6. Gates green, integration tests ran                                                                        | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice. The PR records that `categories.int.test.ts` ran (not skipped) for slices 1–3.                                                                                                                                                                                                                                                                                                                           |

## Not doing (YAGNI)

- Progress bars, the Expenses tab's planned total, and Home's Budget card figure (034). The contract they need is
  `plannedEur` on `useMonth`'s categories.
- A shared `plannedCents(categories)` helper. It has one caller now, so it stays inline. 034 will be the second and
  third caller and can extract it then.
- Copying amounts in a copy, and Notion's "Budget" column (out of scope in the brief).
- Accepting a JSON number for `amount` (as `ExpenseBody` does). The app sends strings, and the brief asks for malformed
  input to get a 400.
- Returning the saved category from the PUT. The Budget tab reloads on focus, so 204 is enough.
- A client-side "month ended" check inside the modal. Rows in an ended month aren't tappable, and a typed link gets the
  server's 409 text.
- Extracting a shared "category in a month" loader. With this modal there are three copies: the Category screen,
  `delete-category`, and the new modal. That's a refactor of two existing screens with no AC behind it, and it would
  push the PR past 400 lines (Follow-ups).

## Risks

- **`ONLY_FULL_GROUP_BY` with the new join in GET one** (`GROUP BY c.category_id`, `b` joined on its full primary
  key). `EXPLAIN` on the local test DB (MySQL 26.7.0, `ONLY_FULL_GROUP_BY` on) accepted it. CI runs `mysql:8.0`.
  Slice 1's integration test on CI proves it. Fallback (about 2 lines): a scalar subquery,
  `COALESCE((SELECT planned_eur FROM category_budgets b WHERE b.category_id = c.category_id AND b.budget_month = ?), 0)`.
- **The Budget tab must refresh after the modal closes.** `useMonth` reloads in `useFocusEffect`. The expense modal
  already relies on this for the Expenses tab, but for the Budget tab the slice 6b web check proves it, and the user's
  iPhone check covers native.
- **`selectTextOnFocus` and `autoFocus` on web and iOS.** These are core `TextInput` props that react-native-web
  supports. Slice 6a's web check and the iPhone check confirm the value is selected. If not, the input still works,
  just without the selection, so the props can be dropped without changing the plan.
- **Concurrent copy and set.** `setPlanned` takes `lockLedger`, like every list change, so a set can't land between
  copy's delete and its insert. This follows from the code rather than a test (same as 029 and 033).
- **Size: about 410 lines, just over the limit.** Slice 6a is about 180 and 6b about 20. If the build overshoots,
  slice 5's refactor of `normalizeAmount` can become a standalone `normalizePlanned` (no lines saved, but less churn).
  There is no further split worth a separate PR.
- **The web check must hit this checkout's API** (same guard as 035; AC setup above).

## Open questions

- No: where the month's planned total sits. Assumed: the right of the Budget tab's "Categories" head, as
  "€4,600 planned". 033 says "at the top"; a summary card like the Expenses tab's is the alternative, at about 15 more
  lines.
- No: the editor's text, which the brief doesn't give. Assumed:
  - title "Planned amount";
  - "Planned for October";
  - invalid input: "Enter an amount in euros, like 120 or 120.50.";
  - the 409 and 404 texts reuse `delete-category`'s wording.
- No: the field starts at the stored value, including `0.00`, with the text selected. Assumed: yes. Leaving it empty
  for €0 is the alternative.
- No: GET one returns the stored amount of a category removed from that month (`inMonth: false`). Assumed: yes. It's
  the amount Undo brings back, and nothing shows it.

## Follow-ups

- Three screens now repeat "load a category in a month" with the same states and texts: `category/[categoryId].tsx`,
  `delete-category.tsx` and `planned-amount.tsx`. A shared loader component is the rule-of-three extraction. It's
  proposed as its own chore PR.
- 033's and 035's follow-ups stand: a conventions §3 note that nothing carries over, and `linkParams.ts`'s `MONTH_RE`
  accepting `9999-12`.

## Deviations

<filled by the developer during build>

## Revision 1 (skeptic: approve, suggestions applied)

- Slice 6a: Cancel is `disabled={busy}` and the screen sets `gestureEnabled: !busy`, as `delete-category.tsx` does,
  so a swipe or Cancel during the PUT can't trigger a second `router.back()`.
- Slice 6a: with no history, `leave()` falls back to
  `router.replace(month ? { pathname: '/budget', params: { month } } : '/budget')`.
- Slice 6 is split into 6a (the modal, `setPlanned` and the `_layout` entry, reachable by link) and 6b (Budget rows
  become pressable), each green on its own. Re-estimated at about 200 lines (6a about 180, 6b about 20). The total is
  now about 410, and the Risks entry on size is updated to match.

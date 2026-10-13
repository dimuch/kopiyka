# Plan: Per-month categories — part 1 of 4, per-month lists in the API

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/per-month-categories
Base: origin/main @ 877bf7c

## Proposed split (needs your OK at Gate A)

The whole brief is about 1,000 changed lines: roughly 530 for the API and migration, and 520 for the app plus removing 013. That is too big for one PR. I propose 4 PRs, in this order. Each one ships on its own, and the app keeps working
after every merge, because each API change stays compatible with the app already on `main`.

| #   | PR (brief)                                                                                                                                                                                                                                                                            | ≈ lines | Safe to ship alone because                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **This plan.** API: the per-month model and migration, a category list per month, and the save rule (an expense can't be saved or moved into a month without its category).                                                                                                           | 310     | Every month inherits one stored list, so all lists match today's. `month` is optional, and the current app gets the current month's list, which is the same list. |
| 2   | API: remove a category from a month, and restore it. `GET one` gets an optional `?month=`. Includes the Notion proof.                                                                                                                                                                 | 240     | New endpoints have no callers yet. 013's all-months delete and restore still work for 018's screen.                                                               |
| 3   | App: Home, the Expenses tab and the Category screen load their month's list. The expense form's categories follow the date's month, with "That category isn’t in November.". The list's `month` becomes required.                                                                     | 220     | No removal is possible yet in the app, so nothing looks different. 018's delete still works.                                                                      |
| 4   | App: Category → ⋯ → "Remove from October", the confirm screen with October's count and total, and Undo on Home. Removes 013/018's all-months delete from the app and the API (endpoints, tests, client calls, copy). `GET one`'s `month` becomes required. Conventions §3 is updated. | 300     | It replaces the only all-months caller in the same PR.                                                                                                            |

**Added at Gate A (user, 2026-10-13): an ended month is read-only** (see the brief's Decisions). Nothing in a month
that ended in Kyiv time can change: expenses (add, edit, delete, restore, move a date in or out) and the category list.
There is no grace period. This doesn't change part 1's slices. It becomes its own part, planned as its own brief
after 029: an API refusal on every expense and category write into an ended month, plus the app's read-only handling
(the date chips and picker, the edit form, Delete and Undo in past months). It also settles the "removing from a past
month" question: that is refused.

Brief numbering: narrow this brief (028) to part 1 and file parts 2–4 as new briefs 029–031, the way 013 was split
into 013, 017 and 018. The brief's ACs are mapped to parts in [AC → evidence](#ac--evidence). Parts 2–4 are outlined
in [Later parts](#later-parts-outline-planned-in-their-own-briefs) so the model can be judged as a whole. Each gets
its own full plan.

## Approach

**The model is one table, `category_months (category_id, list_month, deleted_at)`.** A month's list is the
categories with a live row for that month. A month without its own rows uses the latest earlier month that has rows,
so "a new month carries over the previous month's list" (Decision 1) costs nothing: nothing is stored until a list
changes.

- The migration stores each category once, for `2000-01-01`. `RateDate` doesn't accept earlier dates, so no expense
  can be dated before then. Every month from 2000-01 on inherits that row, so every month shows today's list (the
  migration AC).
- New ledgers (`createUserWithLedger`) are seeded the same way.
- A soft-deleted row (`deleted_at`) means "removed from this month" and still counts as the month having its own
  list, so later months inherit the removal. Undo clears it (part 2).

**One SQL rule, used everywhere.** `categories/monthLists.ts` exports `inMonthList(date)`, a SQL condition: "category
`c` has a live row in the latest stored month on or before this date". The list endpoint, the save rule and expense
restore all use it, and part 2's remove and `GET one` will too. The same pattern already exists as `IN_SCOPE` in
`notion/totals.ts`.

**Expense reads and the Notion sync don't change.** The month's expense list, the month totals (summed from that
list), `loadGroceries` and `loadUncounted` keep filtering on `e.deleted_at`. They stay right because of an invariant:
no live expense sits in a month whose list lacks its category.

- Part 1 keeps the invariant at writes: POST/PUT refuse with 400 `category_not_in_month`, and expense restore
  answers 404.
- Part 2 keeps it at removal: removing a category stamps that month's live expenses with the same `deleted_at`.
- After a removal, that month's groceries become "unwanted", and its other expenses drop out of the uncounted totals,
  with no Notion code change. Part 2's tests prove it.

Alternative considered: give each category a range of months (`from_month`/`to_month`), or store "removals" instead
of lists. Ranges can't express "removed in September, still in October" (Decision 1 plus "other months unchanged"). A
removals-only table can't tell a month that started before the removal from one that started after it. A stored list
per changed month can do both.

Alternative considered: store the starting list at the ledger's creation month and fall back backwards for earlier
months. That needs a second fallback rule and pinning the month before a removal. It also makes the tests depend on
the real date, because `ledgers.created_at` is the DB clock, while the tests pin the API clock to 2026-10-06. A fixed
`2000-01-01` avoids both problems.

## Where the brief no longer matches the code (checked on 52584f0)

- **"Statistics … show only that month's categories".** `app/(tabs)/statistics.tsx` is a `PlaceholderPage` with no
  data, so no part has anything to change there.
- **Compatibility between parts (this plan's own constraint, not the brief's).** `main` has no `deploy/` yet (PR #25
  isn't merged). The running app is the local web and Expo Go build of `main`, against the dev API. Each part keeps
  the API compatible with the app on `main` when it merges, so no part leaves the app broken.
- **013's endpoints and 018's screen are as the brief says.** They are `DELETE /categories/:id`,
  `POST /categories/:id/restore` and `GET /categories/:id` (all months), in `apps/api/src/categories/routes.ts`, plus
  `app/delete-category.tsx`, `data/categories.ts` and `data/categoryDelete.ts`. They stay until part 4 (Decision 3).
- **Ledger 1 is synced to the real Notion.** Part 1 needs no manual Notion check. Its smoke check uses the `claude-qa`
  user. Never press Sync on ledger 1.

## Contracts (part 1)

- **DB:** `apps/api/migrations/007_category_months.sql`:

  ```sql
  -- Brief 028. Each month has its own category list. A month with no rows here uses the latest earlier month that
  -- has some, so a new month carries over the list before it. Every category starts with one row for 2000-01 (the
  -- first month an expense can be dated, see RateDate), so every month keeps today's list until one is changed.
  CREATE TABLE category_months (
    category_id  INT UNSIGNED NOT NULL,
    list_month   DATE         NOT NULL,   -- always day 1: 2026-10-01
    deleted_at   DATETIME     NULL,       -- removed from this month (Undo); the month still counts as having its own list
    PRIMARY KEY (category_id, list_month),
    CONSTRAINT fk_category_months_category FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE CASCADE
  );

  -- Deleted categories (013) too: they stay hidden by categories.deleted_at, and a restore brings them back to every month.
  INSERT INTO category_months (category_id, list_month) SELECT category_id, '2000-01-01' FROM categories;
  ```

  `createUserWithLedger` (`apps/api/src/admin.ts`) inserts the same rows in its transaction:
  `INSERT INTO category_months (category_id, list_month) SELECT category_id, '2000-01-01' FROM categories WHERE ledger_id = ?`,
  with a comment pointing at 007.

- **API module** `apps/api/src/categories/monthLists.ts`:

  ```ts
  /**
   * SQL that is true when category `c` is in the list of the month of a date. That list is the latest stored month
   * on or before the date; a removed row still counts as stored. The outer query must alias categories as `c` (and
   * expenses as `e` for 'e.expense_date'). With '?', the date ('YYYY-MM-DD', any day of the month) is the next param.
   */
  export function inMonthList(date: '?' | 'e.expense_date'): string;
  ```

  The body (fixed fragments only; `${date}` is one of the two literals):

  ```sql
  EXISTS (SELECT 1 FROM category_months m
           WHERE m.category_id = c.category_id AND m.deleted_at IS NULL
             AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                                   JOIN categories lc ON lc.category_id = lm.category_id
                                  WHERE lc.ledger_id = c.ledger_id AND lm.list_month <= ${date}))
  ```

  `apps/api/src/dates.ts` gains `export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;` ('YYYY-MM'). Its uses: the
  expenses `MonthQuery`, the categories list, and part 2's `:month` param, which is the third.

- **API:**
  - `GET /api/ledgers/:id/categories?month=YYYY-MM` → `200 { categories: CategoryDto[], quickCategoryIds: number[] }`.
    - It lists that month's categories, ordered as now (`sort_order, category_id`); `pickQuick` is unchanged.
    - `month` is optional in parts 1–2 and defaults to the current Kyiv month (`kyivToday(now()).slice(0, 7)`), so
      the app on `main` keeps working. Part 3 makes it required.
    - A month before 2000-01 lists nothing.
    - Errors: `400 invalid_request` (malformed month), `401 unauthorized`, `404 not_found` (non-member, from
      `requireLedger`).
  - `POST /api/ledgers/:id/expenses` and `PUT /api/ledgers/:id/expenses/:expenseId` add a new
    `400 { error: 'category_not_in_month' }`.
    - It applies when `categoryId` is a live category of this ledger, but not in the list of `expenseDate`'s month.
      This also covers a PUT that only moves the date.
    - Order of checks: Zod 400, then (PUT) 404 `not_found`, then `unknown_category` (unknown, foreign or deleted, as
      today), then `category_not_in_month`, then `date_in_future`, then 503 `rate_unavailable`. No NBU fetch happens
      for a refused category.
    - `checkCategory(req, reply, categoryId, expenseDate)` does both checks in one query:
      `SELECT ${inMonthList('?')} AS in_month FROM categories c WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL`,
      with params `[expenseDate, categoryId, ledgerId]`. No row means `unknown_category`; `in_month = 0` means
      `category_not_in_month`.
  - `POST /api/ledgers/:id/expenses/:expenseId/restore`: also `404 not_found` when the expense's category isn't in
    the list of the expense's month. `setDeleted`'s restore branch adds `AND ${inMonthList('e.expense_date')}` next
    to `c.deleted_at IS NULL`. This is the per-month form of today's "a restore needs a live category".
  - Unchanged: the expense list, `GET one category`, and 013's delete and restore.
- **App:** none in part 1. Part 3 maps `category_not_in_month`. The app on `main` would show its generic save error,
  but it can't reach that code, because every month's list is the same until part 2's remove exists.
- **New dependencies:** none.

## Slices (part 1)

- [x] 1. Store a category list per month, starting with today's for all months
  - Files: `apps/api/migrations/007_category_months.sql` (new), `apps/api/src/admin.ts`, `apps/api/test/helpers.ts`
    (`category_months` added to `DATA_TABLES`, before `categories`), `apps/api/test/migrations.int.test.ts`.
  - Change: the migration above, plus the seed rows in `createUserWithLedger`.
  - Change (`apps/api/test/migrations.int.test.ts`, the existing `003_category_soft_delete` describe): The 003 test
    calls `makeUser` on a 001–002 schema, and `createUserWithLedger` now inserts into `category_months`, which doesn't
    exist there yet. Replace that call with raw SQL in the test file. Insert a user with
    `totp_secret_enc = encryptSecret(secret, config.totpKey)` and `secret = generateSecret()`, so `authHeader` still
    logs in. Build `TestUser = { userId, ledgerId, username: 'ivanka', secret }`, add the ledger and its owner
    `ledger_members` row, and add the 15 `DEFAULT_CATEGORIES` with `sort_order (i+1)*10`. Keep its assertions
    unchanged. The 007 describe may share this local function, taking its own category list.
  - Tests: `migrations.int.test.ts`, new `describe('007_category_months (MySQL)')`, built like the 003 test:
    - Copy 001–006 to a temp dir and `resetSchema(dir)`. With raw SQL (`makeUser` can't run before 007 now), insert
      a user (`totp_secret_enc = x'00'`), a ledger, and categories `rent` (10), `groceries` (20) and `gym` (30,
      `deleted_at` set), plus a `groceries` expense on 2026-09-15 and one on 2026-10-01.
    - `runMigrations` returns `007_category_months.sql`, and a second run returns `[]`.
    - `category_months` holds exactly one `2000-01-01` row with `deleted_at` NULL for each of the three categories.
    - A ledger made by `makeUser` after the migration has 15 such rows.
  - ≈ 100 lines.
- [x] 2. List the categories of the asked month
  - Files: `apps/api/src/categories/monthLists.ts` (new), `apps/api/src/dates.ts` (`MONTH_RE`),
    `apps/api/src/expenses/routes.ts` (`MonthQuery` uses `MONTH_RE`), `apps/api/src/categories/routes.ts` (list:
    `ListQuery` with optional `month`; `WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}`,
    params `[ledgerId, `${month}-01`]`), `apps/api/test/helpers.ts`, `apps/api/test/categories.int.test.ts`,
    `apps/api/test/migrations.int.test.ts`.
  - Test helper `storeMonthList(db, ledgerId, month: 'YYYY-MM', without: string[])` in `helpers.ts`. It stores a
    month's own list: every category of the ledger except the `without` tech_names. An empty `without` must work
    too: build the SQL so it never sends `NOT IN ()`, which mysql2 turns into a syntax error. Slices 2 and 3 both use
    it; part 2 replaces it in its tests with the real remove.
  - Tests in `categories.int.test.ts`, `describe('month lists')`, clock 2026-10-06:
    - **Inherits the latest earlier list.** After `storeMonthList(…, '2026-10', ['eating_out'])`:
      - `?month=2026-09` and `?month=2000-01` give 15 categories, including `eating_out`;
      - `?month=2026-10` and `?month=2027-03` give 14, without `eating_out`;
      - `?month=1999-12` gives `{ categories: [], quickCategoryIds: [] }`.
    - **A removed row stays out, in later months too.** Store all 15 for 2026-11, then set `gym`'s 2026-11 row's
      `deleted_at`:
      - `?month=2026-11` and `?month=2026-12` give 14, without `gym` but with `eating_out`;
      - `?month=2026-10` still has `gym`.
    - **Without `month`, the current Kyiv month.** With `now = 2026-09-30T21:30:00Z` (Oct 1, 00:30 in Kyiv) and
      October stored without `eating_out`, the list has 14.
    - **Malformed month.** `?month=2026-13` and `?month=2026-1` give 400, asserted with
      `toMatchObject({ error: 'invalid_request' })` (the handler in `app.ts` also sends `issues`).
    - The existing tests (seeded 15, quick row, deleted left out, 401, 404, non-numeric id) pass unchanged.
  - Migration test (slice 1's describe), extended: after 007, for `'2026-09-15'` and `'2026-10-01'`,
    `SELECT c.tech_name FROM categories c WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')} ORDER BY c.sort_order`
    gives `['rent', 'groceries']`, the same as the pre-migration list.
  - ≈ 120 lines.
- [ ] 3. Refuse an expense in a month whose list lacks its category
  - Files: `apps/api/src/expenses/routes.ts` (`checkCategory` takes `expenseDate`; restore guard in `setDeleted`),
    `apps/api/test/expenses.int.test.ts`.
  - Tests in `expenses.int.test.ts`, `describe('month lists')`. The existing rate stub prices any date up to
    2026-10-07.
    - **POST.** After `storeMonthList(…, '2026-10', ['gym'])`, `gym` on 2026-10-06 gives
      `400 { error: 'category_not_in_month' }`, and `?month=2026-10` lists nothing. `gym` on 2026-09-30 gives 201.
    - **PUT.**
      - A `gym` expense on 2026-09-30, moved to 2026-10-01: 400 `category_not_in_month`, and its GET is unchanged.
      - An October `groceries` expense switched to `gym`: 400 `category_not_in_month`.
      - The September one renamed: 200.
    - **Precedence.** A foreign category on an October date still gets `unknown_category`. This is the existing case,
      re-run with October stored.
    - **Restore.** Two `gym` expenses: one on 2026-10-02 and one on 2026-09-30. Delete both, then
      `storeMonthList(…, '2026-10', ['gym'])`. Restoring the October one gives `404 not_found`, and the month list
      stays empty. Restoring the September one gives 200.
  - ≈ 90 lines.

Total ≈ 310 changed lines, tests included.

## AC → evidence

| AC (brief)                                                                               | Part | Evidence                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API: the month list is per month                                                         | 1    | Slice 2: `categories.int.test.ts` › month lists (inherit, removed row, Kyiv default, 400)                                                                                                                                                                        |
| API: the expense form's categories are per month                                         | 1    | Same endpoint with `?month=`. Part 3 wires the form to it.                                                                                                                                                                                                       |
| API: month totals are per month                                                          | 1, 2 | Totals are summed from the month's expense list (already per month). After a removal they drop because that month's expenses are stamped. Part 2 tests: `?month=2026-10` loses them, `2026-09` keeps them.                                                       |
| API: can't save or move an expense into a month without its category (400)               | 1    | Slice 3: `expenses.int.test.ts` › month lists (POST, PUT move, PUT category, precedence)                                                                                                                                                                         |
| API: remove/restore endpoints; only that month; 401, 404 non-member, 404 unknown/removed | 2    | Part 2's plan (outline below)                                                                                                                                                                                                                                    |
| Migration keeps every month's list; nothing visible changes                              | 1    | Slice 1: rows and idempotence. Slice 2: the list for 2026-09 and 2026-10 after 007 equals the list before it. Smoke check in the PR: dev DB migrated, `claude-qa` on web at 390×844: Home, Expenses (Sep, Oct) and the expense form show the same 15 categories. |
| App (web 390×844): Remove from October flow                                              | 4    | Part 4's plan                                                                                                                                                                                                                                                    |
| App: Undo, and "Couldn’t undo" with Retry                                                | 4    | Part 4's plan (017's `UndoToast` already has Retry)                                                                                                                                                                                                              |
| App: the form's categories follow the chosen date's month                                | 3    | Part 3's plan                                                                                                                                                                                                                                                    |
| iPhone (Expo Go): menu, confirm, Remove, Undo                                            | 4    | Part 4's plan                                                                                                                                                                                                                                                    |
| Gates green                                                                              | all  | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit, with `DATABASE_URL_TEST` exported from the main checkout's `.env` so the integration tests run in this worktree                                                              |

## Later parts (outline, planned in their own briefs)

Contracts are given so the model can be judged now. Details may change in each part's own plan.

- **Part 2: API, remove from a month and restore.**
  - `GET /categories/:categoryId?month=YYYY-MM` → `CategoryWithTotalsDto` counting that month's live expenses. It
    answers 404 when the category isn't in that month's list. Without `month` it still counts all months, for 018.
  - `DELETE /categories/:categoryId/months/:month` → 204, or 404 `not_found` when the category isn't in that month's
    list (unknown, foreign, deleted, already removed). In one transaction:
    1. Store month M's inherited list as its own, if M has no rows.
    2. Do the same for M+1, but only when M+1 ≤ the month of `addDays(kyivToday(now), 1)`. That way, months that
       have already started keep their list, and so does the month of Kyiv tomorrow, which `isAfterRateHorizon`
       already accepts for expenses. Without this, removing from October on October 31 would leave a live 1 November
       expense in a month without its category. Test that case.
    3. Stamp the `(category, M)` row and M's live expenses in that category with one `deleted_at`.

    Later months that haven't started yet inherit the removal (Decision 1). This is a new
    `pinMonth(conn, ledgerId, month)` in `monthLists.ts`.

  - `POST /categories/:categoryId/months/:month/restore` → 204, or 404 when it isn't removed. It clears the row and
    exactly the expenses carrying its stamp.
  - Tests:
    - only that month's expenses are affected, and September and November keep both the category and their expenses;
    - removing from a past month keeps the months that have started;
    - 401, non-member 404, unknown or removed 404, malformed month 400;
    - expenses removed earlier on their own stay deleted after a restore;
    - Notion: `loadGroceries` marks only that month's groceries unwanted (and wanted again after restore), and
      `loadUncounted` drops only that month's expenses.
- **Part 3: app, per-month lists and the expense form.**
  - `useMonth` asks for `?month=`.
  - The form loads the list for its date's month and reloads it when the month changes. If the chosen category isn't
    in that month, the form shows "That category isn’t in November." and Save refuses. The API's
    `category_not_in_month` maps to the same text.
  - `month` becomes required on the list.
- **Part 4: app, Remove from October.**
  - The ⋯ menu item becomes "Remove from {Month}". The confirm route gets `month` and the brief's copy ("This also
    deletes its 4 expenses in October (€86.20). Other months keep “eating out”.").
  - After Remove, the app returns Home with "Removed “eating out” from October and 4 expenses · Undo".
  - 013's endpoints and tests, `deleteCategory`/`restoreCategory`, and 018's all-months copy are deleted. `GET one`'s
    `month` becomes required.
  - Conventions §3's "Deleting a category stamps its live expenses…" is updated to the per-month rule.

## Not doing (YAGNI, part 1)

- Dropping `categories.deleted_at` and its filters. Nothing writes the column after part 4, but legacy deleted
  categories rely on it to stay hidden. Listed as a follow-up.
- A quick row per month: it keeps ranking by the latest expense in any month.
- Filtering the expense list or the Notion queries by the month list. The invariant above makes it redundant.
- Months before 2000-01. They list no categories; no expense can be dated there.
- Budgets per month (`category_budgets` is untouched). Create, rename and reorder (014, 015).
- Locking against two concurrent removals. That is part 2's concern; its pin uses a no-op `ON DUPLICATE KEY UPDATE`.

## Risks

- **MySQL might refuse the restore `UPDATE expenses e JOIN categories c …` because the `inMonthList` subquery reads
  `categories` (ER_UPDATE_TABLE_USED, 1093).** Only `expenses` is assigned, so I expect it to pass. Slice 3's restore
  test settles it. Fallback if it fails: inside the restore branch, select the deleted expense's
  `category_id, expense_date` first, check them with `inMonthList('?')`, then run the existing UPDATE.
- **`lm.list_month <= ?` with a `'YYYY-MM-DD'` string param, and an `EXISTS` read back as `0/1` through mysql2.**
  Slices 2 and 3 assert exact lists and codes, so a type surprise fails there.
- **The migration on the dev DB also touches ledger 1.** That is expected, since its lists must survive too. It only
  adds rows and doesn't call Notion. QA uses `claude-qa` only, and nobody presses Sync.
- **Integration tests silently skip in this worktree without `DATABASE_URL_TEST`.** Export it from the main
  checkout's `.env` before running the gates, and check that the MySQL suites ran rather than skipped.

## Open questions

- **No — Gate A decision: the 4-part split and brief numbers** (028 narrowed, then 029–031). Assumption meanwhile:
  this plan is part 1 only.
- **No — carry-over vs "other months unchanged".** I read Decision 1 as applying to months that haven't started yet,
  in Kyiv time. Removing from October in October also leaves November and later without it. Removing from September
  while it's October leaves October (already started) and November (carried over from October) with it. Assumption
  meanwhile: the above (built in part 2; part 1's storage supports it).
- **No — error code name** `category_not_in_month` (400). The app needs it apart from `unknown_category` to say
  "That category isn’t in November.". Assumption meanwhile: this name.
- **No — months before 2000-01 now list no categories** (before, all 15 at €0). They can only be reached by tapping
  back in the Expenses tab 300+ times, and they can't hold expenses. Assumption meanwhile: acceptable.

## Follow-ups

- After part 4, drop `categories.deleted_at` and its filters in a migration. Its only meaning will be "deleted before
  028", which no endpoint can undo.
- Conventions §3 could state the new invariant: "a live expense's category is in its month's list; writes keep it
  so". This is a proposal for part 2 or part 4, not a slice here.
- `apps/api/test/expenses.int.test.ts` › "answers 404 for a missing expense or one in another ledger" asserts
  `expect(res.statusCode).toBe(404)` twice in a row. That is harmless, but one copy can go.

## Deviations

- slice 1: the 003 and 007 tests share one raw-SQL `rawUser` seeder (the plan allows this) and an `oldSchema(last)`
  helper. The 007 user therefore has a real encrypted TOTP secret, not `x'00'`.

## Revision 1

- Skeptic #5: slice 1 now also rewrites the 003 migration test's `makeUser` call as raw SQL, so it runs on its
  001–002 schema. Slice 1 grows to ≈100 lines, and part 1 to ≈310.
- Base is now 877bf7c. This brief is 028 (027 was taken), so parts 2–4 become proposed briefs 029–031.
- Skeptic suggestions taken:
  - (a) Part 2's M+1 pin compares against the month of Kyiv tomorrow, which is the rate horizon.
  - (b) The compatibility bullet now says it is this plan's own constraint.
  - (c) The malformed-month tests use `toMatchObject`.
- Not taken: (d), shrinking the outline of parts 2–4. Those parts are re-planned in their own briefs anyway.

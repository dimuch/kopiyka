# Plan: Monthly budget — part 1 of 5, months stand alone (API) and Copy the previous month

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/monthly-budget
Base: origin/main @ e07f734

## Proposed split (needs your OK at Gate A)

The whole brief is about 1,800 changed lines: roughly 1,000 for the API (a migration that writes every month's list
out, the end of carry-over, copy, add with name reuse, planned amounts, per-month names) and 800 for the app (a new
Budget tab, an amount and name editor, empty states on two screens). That is more than four times the ~400-line limit.
I propose 5 sequential briefs, each its own PR from `main`:

| #   | Brief                              | What                                                                                                                                                                                                                                                                                                                                                                                                                    | ≈ lines            |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | **033, narrowed (this plan)**      | API: migration 008 writes each ledger's lists out from its first month up to now. Nothing carries over any more, so later months start with no budget. An expense can't be saved into a month with no budget. New ledgers start with their own month. `POST …/months/:month/copy` copies the previous month's list. App: the Remove warning stops saying "later months won’t have it".                                  | 400 added, 155 del |
| 2   | 035 Budget tab: set up a month     | App: the Budget tab with the Expenses tab's month switcher (extracted to a component), the month's categories, and "No budget for November yet" with "Copy October’s categories" (only when October has a list). An ended month has no edit controls. The Expenses tab's no-budget state links to the Budget tab. The form shows "Set up November’s budget first.", and its default category copes with an empty month. | 350                |
| 3   | 036 Planned amounts                | API: the list gives `plannedEur` from the existing `category_budgets` (no row = €0). `PUT …/categories/:categoryId/months/:month/planned` sets it. Copy clears the month's amounts. Remove and Undo keep them, because the row isn't touched. App: amounts on the Budget rows, the month's planned total, and an amount editor.                                                                                         | 380                |
| 4   | 037 Rename a category in one month | Migration 009: `category_months.display_name`, filled from `categories.display_name`. Lists and `GET one` read the month's name. Copy copies names. `PUT …/months/:month/name` renames, checking 1–40 characters and that the name is unique in that month. Undo of a removal whose name is now taken is decided there. App: rename on the Budget tab. Notion stays on `tech_name`.                                     | 380                |
| 5   | 038 Add a category to a month      | API: `POST …/months/:month/categories`. A name that matches any month's name of a live category, latest month first, reuses that category. Otherwise a new category gets a unique `tech_name`. A removed row is revived at €0. App: "Add a category" in the empty state and under the list.                                                                                                                             | 380                |

Part 1 and part 2 ship "set up a month by copying". 034 (progress) builds on part 3. I ordered rename before add so that
add's name lookup is built once, against per-month names. Swapping them is possible: add would then match
`categories.display_name` only, and part 5 would widen the lookup.

**Each part leaves the app working, with one dated exception.** After part 1, November has no list. Until part 2 lands,
the app has no button to set it up: the Expenses tab shows an empty card for November, and the form can't save into
it. Nothing is broken before 2026-10-31, the first day an expense can be dated 1 November. See Open questions.

Brief numbering, as for 028: narrow 033 to part 1, and file parts 2–5 as new briefs 035–038 (034 is taken). The
brief's ACs are mapped to parts in [AC → evidence](#ac--evidence), and parts 2–5 are outlined under
[Later parts](#later-parts-outline-planned-in-their-own-briefs).

## Approach

**A month's list is exactly its own rows in `category_months`.** `inMonthList` stops looking for "the latest stored
month on or before" and checks the row of the date's own month. A month with no live row has no budget. So "an expense
in a month with no budget is refused" needs no new code: every category is outside that month's list, and the existing
`400 category_not_in_month` answers.

**Migration 008 writes out what each month inherits today.** It works per ledger, from that ledger's first month
up to now (Gate A decision, Revision 2). A month without its own rows gets the live rows of the month it inherits
from. This is 029's `pinMonth` rule, done once for every month. Months with their own rows (a removal happened there)
keep them, including removed rows and their Undo stamps. Later months get nothing. The file runs in one transaction.

- **A ledger's first month** is the earlier of:
  - the month of `ledgers.created_at`;
  - the month of the ledger's earliest expense, soft-deleted ones included.
- **Months before the first month have no budget.** The migration deletes the ledger's rows there (the `2000-01` seed
  rows), after they have served as the source of the inherited lists.
- **`created_at` is read as stored.** It is in the DB server's zone (`DEFAULT CURRENT_TIMESTAMP`; the dev DB's
  `time_zone` is `SYSTEM`, which is CEST). For a server at or west of Kyiv (UTC, CET/CEST), that month is never later
  than the Kyiv month. Near midnight on the 1st it can be a month early, which only adds one month.
- **"Now" is `UTC_TIMESTAMP() + 3 h`.** MySQL here has no time-zone tables (`CONVERT_TZ(…, 'Europe/Kyiv')` gives NULL).
  Kyiv is UTC+2 or +3, so this is never a month early. In winter it can be one hour ahead on a month's last evening.
- **A month that already holds a live expense** of the ledger also keeps its list. On a month's last day an expense
  can be dated Kyiv tomorrow, and it must not end up in a month without its category.
- **On the dev DB** (read-only dry run of both statements), the migration adds 45 rows and deletes 30:
  - ledger 1: first month October 2026. It gains 15 October rows and loses its 15 `2000-01` rows. Its September and
    earlier then have no budget; it has no expenses there.
  - ledger 2: first month September 2026, from an expense. It gains 15 rows each for September and October, and loses
    its 15 `2000-01` rows.

**Remove and restore lose their carry-over code.** `pinMonth`, `keepNext` and `>= first` go. A removal stamps that
month's row and its expenses, and nothing else. The Remove warning then always says "Other months keep “eating out”."

**New ledgers** (`createUserWithLedger`, admin only) get the 15 defaults in their Kyiv month of creation, instead of
one `2000-01` row that every month inherited.

**Copy** sets up a month with no budget from the month before it. It runs in one transaction under 029's
`lockLedger`. Removed rows still in that month are deleted first, so the insert can't collide with them.

Alternative considered: keep carry-over, and freeze it at a cutoff month stored in the code. That avoids writing rows,
but every list read would keep the `MAX(list_month)` subquery plus a second rule. The brief asks for "a month
has exactly its own list", and writing the lists out once makes every read a primary-key lookup.

Alternative considered: a new `400 no_budget` code. The app knows the month's list is empty before it saves (part 2
shows "Set up November’s budget first." from that), so a second code has no caller. See Open questions.

## Checked on e07f734

- Carry-over lives only in `apps/api/src/categories/monthLists.ts`: `inMonthList`, `pinMonth`, `keepNext` in
  `removeFromMonth`, and `>= ?` in `restoreToMonth`. The `2000-01-01` seed lives in `admin.ts:44–46` and migration 007. `inMonthList` has 4 callers: the list and `GET one` (`categories/routes.ts`), `checkCategory` and the restore
  guard in `setDeleted` (`expenses/routes.ts`). The 007 migration test also uses it.
- The Notion sync matches rows by `tech_name` (`notionNames`, `IN_SCOPE`, groceries' `c.tech_name = 'groceries'`),
  never by `display_name`. It doesn't read `category_months`. Part 1 doesn't change it. Part 4 keeps it on `tech_name`,
  so a rename never changes what syncs.
- `category_budgets (category_id, budget_month, planned_eur DECIMAL(12,2) DEFAULT 0, updated_at)` exists (001) and
  nothing reads or writes it, apart from `DATA_TABLES` in the test helpers. Part 1 leaves it alone.
- Dev DB (read-only queries):
  - MySQL 26.7.0, `cte_max_recursion_depth` 1000, no time-zone tables, and `time_zone` `SYSTEM` (CEST).
  - Migrations 001–007 are applied.
  - Ledgers 1 and 2 have only `2000-01` rows (15 each, none removed).
  - Ledger 1 was created 2026-10-06 22:59:50, with its earliest expense on 2026-10-01. Ledger 2 was created
    2026-10-06 23:25:00, with its earliest expense on 2026-09-01.
- `EXPLAIN` (which doesn't execute anything) on the test DB accepts migration 008's
  `INSERT INTO category_months … WITH RECURSIVE … SELECT … FROM category_months` and its `DELETE m FROM … JOIN ledgers`.
  It also accepts copy's
  `DELETE m FROM … JOIN` and its `INSERT … SELECT` from the same table. MySQL gives
  `DATE_FORMAT('2026-10-06', '%Y-%m-01') = DATE '2026-10-01'` as 1, which is the new `inMonthList`'s comparison.
- The integration suites that write expenses through the API run on clock 2026-10-06 and use September and October
  2026 dates (`expenses.int`, `categories.int`). The Notion suites insert expenses with raw SQL and never go through
  month lists.
- `removeWarning(c, month, today)` has one caller, `app/delete-category.tsx:90–91`, which reads `kyivToday` only for
  it.
- Migrations run by hand (`yarn api migrate`). From each ledger's first month on, 008's rows give the same lists
  under the old rule, so the dev DB can be migrated while `main`'s API still runs. Months before the first month
  become empty at once. This holds as long as migrating and deploying fall in the same Kyiv month (see Risks).

## Contracts (part 1)

- **DB: `apps/api/migrations/008_months_stand_alone.sql`** (no schema change):

  ```sql
  -- Brief 033. A month's category list is exactly its own rows here: nothing carries over any more, and a month with
  -- no live row has no budget yet. Each ledger's months from its first month (the earlier of the month it was created
  -- and the month of its earliest expense, deleted ones included) up to now keep the list they inherited (brief 028),
  -- written out as their own rows; earlier and later months have no budget. created_at is in the DB server's zone,
  -- never later than Kyiv's month for a server at or west of Kyiv. Kyiv is UTC+2 or +3, so UTC+3 is never a month
  -- early. A month that already holds a live expense keeps its list too (on a month's last day an expense can be
  -- dated Kyiv tomorrow). Only live rows of live categories are copied: a month's own removed rows keep their Undo
  -- stamp, and categories deleted before 028 stay hidden by categories.deleted_at.
  START TRANSACTION;

  INSERT INTO category_months (category_id, list_month)
  WITH RECURSIVE
    bounds (ledger_id, first_month, last_day) AS (
      SELECT l.ledger_id,
             LEAST(DATE(DATE_FORMAT(l.created_at, '%Y-%m-01')),
                   COALESCE((SELECT DATE(DATE_FORMAT(MIN(e.expense_date), '%Y-%m-01'))
                               FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                              WHERE ec.ledger_id = l.ledger_id), DATE '9999-12-01')),
             GREATEST(DATE(UTC_TIMESTAMP() + INTERVAL 3 HOUR),
                      COALESCE((SELECT MAX(e.expense_date)
                                  FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                                 WHERE ec.ledger_id = l.ledger_id AND e.deleted_at IS NULL), DATE '2000-01-01'))
        FROM ledgers l),
    months (list_month) AS (
      SELECT MIN(first_month) FROM bounds
      UNION ALL
      SELECT list_month + INTERVAL 1 MONTH FROM months
       WHERE list_month + INTERVAL 1 MONTH <= (SELECT MAX(last_day) FROM bounds))
  SELECT m.category_id, mo.list_month
    FROM months mo
    JOIN bounds b ON mo.list_month BETWEEN b.first_month AND b.last_day
    JOIN categories c ON c.ledger_id = b.ledger_id AND c.deleted_at IS NULL
    JOIN category_months m ON m.category_id = c.category_id AND m.deleted_at IS NULL
   WHERE m.list_month < mo.list_month -- a month with its own rows keeps them
     AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                           JOIN categories lc ON lc.category_id = lm.category_id
                          WHERE lc.ledger_id = c.ledger_id AND lm.list_month <= mo.list_month);

  -- Months before a ledger's first month have no budget: drop their rows (the 2000-01 seed), now that the inherited
  -- lists are written out.
  DELETE m FROM category_months m
    JOIN categories c ON c.category_id = m.category_id
    JOIN ledgers l ON l.ledger_id = c.ledger_id
   WHERE m.list_month < LEAST(DATE(DATE_FORMAT(l.created_at, '%Y-%m-01')),
                              COALESCE((SELECT DATE(DATE_FORMAT(MIN(e.expense_date), '%Y-%m-01'))
                                          FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                                         WHERE ec.ledger_id = l.ledger_id), DATE '9999-12-01'));

  COMMIT;
  ```

  The first-month expression appears twice, once per statement, because a CTE can't span statements. A ledger with no
  categories gets nothing. With no ledgers at all (a fresh test DB), the `months` anchor is NULL and nothing is
  inserted.

- **API, `apps/api/src/categories/monthLists.ts`:**
  - `inMonthList(date: '?' | 'e.expense_date')`: same signature and callers. The body becomes
    `EXISTS (SELECT 1 FROM category_months m WHERE m.category_id = c.category_id AND m.deleted_at IS NULL AND m.list_month = DATE_FORMAT(${date}, '%Y-%m-01'))`.
    The JSDoc says: "the list of the date's own month; nothing carries over (brief 033)".
  - `removeFromMonth(db, ledgerId, categoryId, month, now)`: same signature and answers. `pinMonth` and `keepNext`
    go. The row update is `m.list_month = ?`.
  - `restoreToMonth(db, ledgerId, categoryId, month)`: same signature and answers. The row update is
    `m.list_month = ?`.
  - `lockLedger`'s comment becomes "One list change per ledger at a time: a check and the write after it see the same
    list".
  - New:

    ```ts
    /** What copying the previous month's list into a month did. */
    export type CopyResult = 'copied' | 'budget_exists' | 'no_previous_budget';
    /**
     * Sets up a 'YYYY-MM' month with no budget (no live category) with the previous month's live categories. Rows
     * removed from it earlier are deleted first: their Undo then answers 404, and their expenses stay deleted.
     */
    export async function copyPreviousMonth(db: Db, ledgerId: number, month: string): Promise<CopyResult>;
    ```

    It runs in `withTransaction` with `lockLedger`. Here `first = `${month}-01`` and
    `previous = previousMonthStart(month)`:
    1. If `hasBudget(conn, ledgerId, first)`, it answers `'budget_exists'`.
    2. If not `hasBudget(conn, ledgerId, previous)`, it answers `'no_previous_budget'`.
    3. `DELETE m FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE c.ledger_id = ? AND m.list_month = ?`
       with `[ledgerId, first]`.
    4. `INSERT INTO category_months (category_id, list_month) SELECT m.category_id, ? FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ?`
       with `[first, ledgerId, previous]`.
    5. It answers `'copied'`.

    `hasBudget(conn, ledgerId, first)` is a private helper with two calls:
    `SELECT 1 FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ? LIMIT 1`.

- **API, `apps/api/src/dates.ts`:** new
  `/** First day of the month before a 'YYYY-MM' month. */ export function previousMonthStart(month: string): string`,
  computed as `addDays(`${month}-01`, -1).slice(0, 7) + '-01'`. Its sibling is `nextMonthStart`.

- **API, `POST /api/ledgers/:id/months/:month/copy`** (no body) → `204`. It lives in `categories/routes.ts`, with the
  usual guards.
  - Params: `month` matches `MONTH_RE` ('YYYY-MM'); `id` comes from `requireLedger`.
  - Order of checks: Zod 400, then `monthEnded(month, now())` → `409 month_ended`, then `copyPreviousMonth`.
  - Errors:
    - `400 invalid_request`: malformed month or id;
    - `401 unauthorized`;
    - `404 not_found`: not a member;
    - `409 month_ended`: the month has ended in Kyiv;
    - `409 budget_exists`: the month already has a live category;
    - `409 no_previous_budget`: the previous month has no live category.
- **API, unchanged contracts with new behaviour:**
  - `GET …/categories?month=`: lists exactly that month's own live rows. A month with none gives
    `{ categories: [], quickCategoryIds: [] }`.
  - `POST`/`PUT …/expenses`: `400 category_not_in_month` also for any date in a month with no budget, with the same
    precedence as 028.
  - `GET one ?month=`: gives `inMonth: false` for a month without a list.
  - The remove and restore endpoints affect that month only.
- **Admin, `createUserWithLedger(db, totpKey, input, now: Date)`:** the new `now` is the first parameter added.
  - The seed becomes
    `INSERT INTO category_months (category_id, list_month) SELECT category_id, ? FROM categories WHERE ledger_id = ?`,
    with `` `${kyivToday(now).slice(0, 7)}-01` ``.
  - `scripts/create-user.ts` passes `new Date()`.
- **Test helpers, `apps/api/test/helpers.ts`:**
  - `makeUser` passes `new Date('2026-10-06T10:00:00Z')` (every suite's clock) and stores September too. Its JSDoc
    becomes: "A user with a ledger whose September and October 2026 have the 15 defaults; other months have no
    budget".
  - `storeMonthList(db, ledgerId, month, without)` _replaces_ a month's own list: it deletes the month's rows for the
    ledger, then inserts as now.
- **App, `apps/mobile/src/data/categoryRemove.ts`:**
  - `removeWarning(c, month)`: the `today` parameter goes.
  - The tail is always `Other months keep “eating out”. You can undo right after.`
  - Bodies, actions and `removedMessage` are otherwise unchanged.
- **New dependencies:** none.

## Slices (part 1)

- [x] 1. Write every month's inherited category list out as its own
  - Files: `apps/api/migrations/008_months_stand_alone.sql` (new), `apps/api/test/migrations.int.test.ts`.
  - Change: the migration above. The code still reads with carry-over, which gives the same lists over the written-out
    rows from each ledger's first month on. Months before the first month now list nothing; that is the Gate A
    decision.
  - Test changes, `migrations.int.test.ts`:
    - `oldSchema`'s file list gains `'007_category_months.sql'`.
    - The 007 describe now tests 007 alone. It copies `007_category_months.sql` into its temp `dir` and calls
      `runMigrations(TEST_DB_URL!, dir)`, which still gives `['007_category_months.sql']`.
  - Tests, new `describe('008_months_stand_alone (MySQL)')`, built like 007's:
    - `oldSchema('007_category_months.sql')`. Ledger A comes from `rawUser`: `rent` (10), `groceries` (20), and `gym`
      (30, with `categories.deleted_at` set).
      - It gets `2000-01-01` rows for all three, as 007 gives existing categories.
      - It also gets its own `2026-08-01` rows: `rent` live, and `groceries` removed with a fixed stamp.
      - `ledgers.created_at` is set to `'2026-06-10 12:00:00'`.
      - It gets a soft-deleted `rent` expense on 2026-05-20, so its first month is May 2026 (the earliest expense,
        deleted or not, before the creation month).
    - Ledger B (`rawUser 'dmytro'`, `car`) gets a `2000-01-01` row and two expenses:
      - a live one on the 15th of `thisMonth + 3`;
      - a deleted one on the 15th of `thisMonth + 5`.

      Its `created_at` is set to the 15th of `thisMonth`, 12:00, so its first month is `thisMonth`, from the
      creation date. `thisMonth` is `kyivToday(new Date()).slice(0, 7)`. `+ n` steps with `nextMonthStart`, and
      `thisMonth - 1` is `addDays(`${thisMonth}-01`, -1).slice(0, 7)`.

    - `runMigrations(TEST_DB_URL!)` gives `['008_months_stand_alone.sql']`, and a second run gives `[]`.
    - A local `own(ledgerId, month)` lists the `tech_name`s of a month's live rows of live categories, by
      `sort_order`. Expected:
      - A, `2000-01` and `2026-04`: `[]` (before the first month; the seed rows are gone).
      - A, `2026-05` and `2026-07`: `['rent', 'groceries']`.
      - A, `2026-08`: `['rent']`, and `groceries`' row still carries its stamp.
      - A, `2026-09` and `thisMonth`: `['rent']`.
      - A, `thisMonth + 2` and `thisMonth + 3`: `[]`. `thisMonth + 1` isn't asserted, because of the winter hour.
      - B, `thisMonth - 1`: `[]`. B, `thisMonth` and `thisMonth + 3`: `['car']`. B, `thisMonth + 4`: `[]`.
      - `gym` has no row left: its only row was the `2000-01` seed.
      - `SELECT COUNT(*) FROM category_months WHERE list_month = '2000-01-01'` is 0.
  - ≈ 125 lines.
- [x] 2. Start a new ledger's list in its own month
  - Files:
    - `apps/api/src/admin.ts`
    - `apps/api/scripts/create-user.ts`
    - `apps/api/test/helpers.ts`
    - `apps/api/test/migrations.int.test.ts`
    - `apps/api/test/categories.int.test.ts`
  - Change: `createUserWithLedger`'s `now` and seed, `makeUser` and `storeMonthList` as in Contracts. Reads still carry
    over, so the fixture's later months inherit October.
  - Tests:
    - The 007 describe's "A ledger made after the migration…" block moves to the 008 describe, as
      `it('starts a new ledger with the defaults in its own Kyiv month')`:
      `createUserWithLedger(db, config.totpKey, {...}, new Date('2026-10-31T22:30:00Z'))` (1 November, 00:30 in Kyiv)
      gives 15 rows, all `2026-11-01`, none removed.
    - In `categories.int.test.ts` › month lists, the first test drops `'2000-01'` from the 15-category loop. It now
      expects `?month=2000-01` to give `{ categories: [], quickCategoryIds: [] }`, like `1999-12`.
    - In "removes it and its expenses from that month only", the expected `category_months` rows start with
      `['2026-09', null]` instead of `['2000-01', null]`.
  - ≈ 50 lines.
- [x] 3. Give each month exactly its own category list
  - Files:
    - `apps/api/src/categories/monthLists.ts`
    - `apps/api/test/helpers.ts` (the `storeMonthList` JSDoc)
    - `apps/api/test/categories.int.test.ts`
    - `apps/api/test/expenses.int.test.ts`
    - `apps/api/test/migrations.int.test.ts`
  - Change: `inMonthList`, `removeFromMonth` and `restoreToMonth` as in Contracts. Delete `pinMonth`, and the now
    unused `addDays` and `kyivToday` imports. The header comment says "Brief 028, 033: a month's list is exactly its
    own rows; nothing carries over".
  - Also fix the carry-over wording that is now stale:
    - `restoreToMonth`'s JSDoc: "the rows (that month and later)" becomes "that month's row", and "only inherited"
      becomes "not in that month's list".
    - In `apps/api/src/categories/routes.ts`, the `CategoryWithTotalsDto.inMonth` comment "(removed there or
      earlier)" becomes "(removed there, or the month has no list)".
  - Tests, `categories.int.test.ts` (clock 2026-10-06; the fixture has September and October):
    - **month lists:**
      - "lists exactly the month's own list": with `storeMonthList(…, '2026-10', ['eating_out'])`:
        - 2026-10 has 14, without `eating_out`;
        - 2026-09 has 15;
        - `2026-11`, `2000-01` and `1999-12` each give `{ categories: [], quickCategoryIds: [] }`.
      - "leaves a removed row out of its own month only": store November, then mark `gym`'s November row removed.
        November has 14, without `gym` but with `eating_out`. December gives `[]`. October still has `gym`.
    - **one category:** the comment becomes "Not in that month's list, or the month has none". The cases are unchanged.
    - **remove from a month:**
      - "removes it and its expenses from that month only" now runs on the default clock, after
        `storeMonthList(…, '2026-11', [])`.
        - Lists: September 15, October 14, November 15, December 0.
        - The expense stamps are unchanged.
        - Rows: `[['2026-09', null], ['2026-10', now], ['2026-11', null]]`.
      - "carries the removal over…" and "also takes it out of a later month…" are replaced by "leaves the other
        months' lists as they are":
        - Store November and December. Remove `gym` from December, then `eating_out` from October.
        - December lacks `gym` and has `eating_out`. November has both. October lacks `eating_out` and has `gym`.
      - The 404 test's `[eating_out, '2026-11']` comment becomes "the month has no list".
    - **restore to a month:**
      - "brings back exactly what that removal took" checks October only (November has no list).
      - "brings it back to a later month that has its own list" is replaced by "brings it back to that month only":
        - Store November, then remove `eating_out` from October and from November.
        - Restoring October gives 204. October has it; November still lacks it.
      - In the 404 test, `[eating_out, '2026-11']`'s comment becomes "the month has no list".
    - "Notion after a removal" and the guards are unchanged.
  - Tests, `expenses.int.test.ts` › month lists, new
    `it('refuses an expense in a month with no budget, before pricing it')`:
    - A `groceries` POST dated `2026-08-20` gives `400 { error: 'category_not_in_month' }`, and `fetchRate` is never
      asked.
    - After `storeMonthList(…, '2026-08', [])`, the same POST gives 201.
    - The existing tests pass unchanged. `withoutGymInOctober` works with `storeMonthList`'s replace.
  - Tests, `migrations.int.test.ts`: the 007 describe's `inMonthList` loop and import go. After 007 alone, only
    2000-01 has rows. The 008 describe covers the lists.
  - ≈ 75 lines added, ≈ 100 deleted.
- [x] 4. Say other months keep a category removed from one month
  - Files:
    - `apps/mobile/src/data/categoryRemove.ts`
    - `apps/mobile/src/app/delete-category.tsx` (drop `today`, its comment, and the `kyivToday` import)
    - `apps/mobile/test/categoryRemove.test.ts`
  - Change: `removeWarning(c, month)` as in Contracts, and the now unused `addDays` and `shiftMonth` imports in
    `categoryRemove.ts` go. Its JSDoc says a removal touches only that month (brief 033). This slice stays right
    after slice 3, so the stale text lives for one commit only.
  - Tests: `keep` becomes `Other months keep “eating out”. You can undo right after.` in "warns what goes in that
    month" (4 rows) and "names the month". Delete the four `today` tests:
    - the last day;
    - an ended month;
    - across a year end;
    - any other day.
  - Verify (web 390×844, this worktree's API, QA user, see Risks): Category → ⋯ → Remove from October shows
    `… in October (€…). Other months keep “…”. You can undo right after.`. Cancel.
  - ≈ 10 lines added, ≈ 45 deleted.
- [ ] 5. Set up a month by copying the previous month's categories
  - Files:
    - `apps/api/src/dates.ts`
    - `apps/api/src/categories/monthLists.ts`
    - `apps/api/src/categories/routes.ts`
    - `apps/api/test/dates.test.ts`
    - `apps/api/test/categories.int.test.ts`
  - Change: `previousMonthStart`, `copyPreviousMonth` and the route, as in Contracts. The route's params schema is
    `z.object({ month: z.string().regex(MONTH_RE, 'expected YYYY-MM') })`.
  - Tests, `dates.test.ts`: "finds the first day of the previous month, across a year start":
    `previousMonthStart('2027-01')` is `'2026-12-01'`, and `previousMonthStart('2026-03')` is `'2026-02-01'`.
  - Tests, `categories.int.test.ts`, new `describe('copy the previous month')`, with a local
    `copy(month, headers = auth, ledgerId = owner.ledgerId)`:
    - "sets up a month with the previous month's list, in its order":
      - Remove `eating_out` from October, then copy `2026-11`. It gives 204.
      - `listOf('2026-11')` equals `listOf('2026-10')` (14, same order).
      - September and October are unchanged.
    - "refuses a month that has a budget": copying `2026-10` gives `409 { error: 'budget_exists' }`, and the
      `category_months` row count is unchanged.
    - "refuses when the previous month has no budget":
      - Copying `2026-12` gives `409 { error: 'no_previous_budget' }`, and December lists `[]`.
      - Then store November with every row removed (`storeMonthList` plus one `UPDATE`). Copying `2026-12` still
        gives `no_previous_budget`.
    - "starts a month whose categories were all removed afresh":
      - Store November. Add a `gym` expense on 2026-11-02 (`addSpend`). Stamp every November row and that expense
        with one `deleted_at`. November lists `[]`.
      - Copying `2026-11` gives 204, and November lists 15.
      - The expense's GET is 404, and `restoreTo(gym, …, '2026-11')` gives `404 not_found`.
    - "refuses a month that has ended in Kyiv, changing nothing": copying `2026-08` on the default clock gives
      `409 { error: 'month_ended' }`. The row count is unchanged.
    - "rejects a malformed month": `2026-13`, `2026-1` and `abc` give 400 `invalid_request`.
    - "needs a session and a ledger of mine": no headers gives 401. The stranger's ledger with my session gives 404.
  - ≈ 140 lines.

Total ≈ 400 added and ≈ 155 deleted, tests included. It is over ~400 changed lines only because of the deletions
(carry-over code, its tests, and the last-day copy). Slices 1–5 are each ≤ ~150.

## AC → evidence

| AC (brief)                                                                                                                                         | Part       | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration: every month from the ledger's first month to now keeps its list (own or inherited), planned €0; earlier and later months have no budget | 1 (+3)     | Slice 1: the 008 describe (first month from a deleted expense and from `created_at`, empty before it, inherited, own with stamp, deleted category, the live-expense month, empty later months, idempotent). Slice 3: lists read exactly those rows. "Planned €0" is the absent `category_budgets` row; part 3 tests that a migrated month lists `plannedEur: '0.00'`. Smoke check below |
| API: copy, add, set amount, rename endpoints with 400/409/401/404 tests                                                                            | 1, 3, 4, 5 | Copy: slice 5 (happy, `no_previous_budget`, `budget_exists`, `month_ended`, 400, 401, 404). Amount: part 3. Rename: part 4. Add (empty, long and duplicate names): part 5                                                                                                                                                                                                               |
| API: rename in October leaves September; a copy into November takes October's names                                                                | 4          | Part 4's plan. Copy keeps order and categories already (slice 5)                                                                                                                                                                                                                                                                                                                        |
| API: an expense in a month with no budget is refused (400)                                                                                         | 1          | Slice 3: `expenses.int` › "refuses an expense in a month with no budget, before pricing it" (`400 category_not_in_month`, no rate fetched)                                                                                                                                                                                                                                              |
| App: empty screen; Copy fills it at €0; Add adds one at €0                                                                                         | 2, 3, 5    | Part 2 (empty screen, Copy), part 3 (€0 shown), part 5 (Add)                                                                                                                                                                                                                                                                                                                            |
| App: amount updates row and total; rename shows on Budget, Expenses, Category screen and form, that month only                                     | 3, 4       | Parts 3 and 4                                                                                                                                                                                                                                                                                                                                                                           |
| App: no-budget month: Expenses tab points to Budget; form shows "Set up November’s budget first."                                                  | 2          | Part 2                                                                                                                                                                                                                                                                                                                                                                                  |
| App: an ended month's Budget tab has no edit controls                                                                                              | 2–5        | Each part hides its own control (Copy, amount, rename, Add) on an ended month                                                                                                                                                                                                                                                                                                           |
| iPhone (Expo Go)                                                                                                                                   | 2–5        | Each app part. Part 1's only app change is a copy string, checked on web (slice 4)                                                                                                                                                                                                                                                                                                      |
| Gates green, integration tests ran                                                                                                                 | all        | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit, with `DATABASE_URL_TEST` from `/Users/dmytro.kostylov/home/kopiyka/apps/api/.env` exported, and the MySQL suites shown as run, not skipped                                                                                                                                                          |
| Remove: the same confirm screen and Undo; the planned amount goes and comes back                                                                   | 1, 3       | Slice 3 (remove and restore touch only that month). Slice 4 (copy). Part 3 (the amount survives, because Remove and Undo don't touch `category_budgets`)                                                                                                                                                                                                                                |
| Notes: which name the Notion sync uses                                                                                                             | 1, 4       | `tech_name` (see Checked). No Notion code changes in any part. Part 4 adds a test that a rename leaves `loadUncounted`'s `techName` alone                                                                                                                                                                                                                                               |

**Smoke check for the PR** (after slice 5):

- `yarn api migrate` on the dev DB. Then check, read-only, with `SELECT`s:
  - ledger 1: 15 live rows for 2026-10, and none for 2026-09 or 2026-11;
  - ledger 2: 15 each for 2026-09 and 2026-10, and none for 2026-08 or 2026-11;
  - no `2000-01-01` rows left.
- On web at 390×844 as a fresh QA user: the Expenses tab's October shows 15 categories and November an empty list.
  The form for today offers October's categories.
- Never log in as ledger 1, and never press Sync.

## Later parts (outline, planned in their own briefs)

The contracts are given so the model can be judged now. Each part's own plan may change details.

- **Part 2 (035), app, Budget tab: set up a month.**
  - The month switcher moves from `(tabs)/expenses.tsx` into `components/MonthSwitcher.tsx` (a mechanical slice),
    used by both tabs.
  - `(tabs)/budget.tsx` lists the month's categories (`useMonth`'s categories).
  - The empty state reads "No budget for November yet". "Copy October’s categories" shows when
    `categories?month=<previous>` isn't empty. It calls `copyPreviousMonth(ledgerId, month)` in `data/categories.ts`,
    then reloads.
    - `409 budget_exists`: reload.
    - `409 no_previous_budget`: hide the button.
    - `409 month_ended`: "November has ended, so it can’t change."
  - An ended month shows no button.
  - The Expenses tab's empty month shows the same line, with a button to the Budget tab on that month.
  - The form: an empty month list shows "Set up November’s budget first." in place of the picker, and Save refuses.
    `firstQuickId` stays null until a non-empty list loads.
- **Part 3 (036), planned amounts.**
  - `CategoryDto` gains `plannedEur: string` (decimal string, `'0.00'` without a row), from
    `LEFT JOIN category_budgets b ON b.category_id = c.category_id AND b.budget_month = ?`.
  - `PUT /api/ledgers/:id/categories/:categoryId/months/:month/planned` takes `{ amount: '120.00' }` (≥ 0, at most
    2 decimals, `AMOUNT_RE`) and gives 204. Errors: 400, 401, 404 (not a member, or not in that month's list),
    409 `month_ended`.
  - Copy deletes the month's `category_budgets` rows, so a copy starts at €0.
  - App: `plannedEur` on Budget rows and the month's total (cents). A new `/planned-amount` modal uses a `format.ts`
    `normalizePlanned` (≥ 0) with unit tests.
- **Part 4 (037), rename in one month.**
  - Migration 009 adds `category_months.display_name VARCHAR(100) NOT NULL DEFAULT ''`, filled from
    `categories.display_name`.
  - Lists read the month's name. `GET one` reads the month's name, or for a month without the category the latest
    earlier one, or `categories.display_name`.
  - Copy copies names. `PUT …/categories/:categoryId/months/:month/name` takes `{ name }` and gives 204. Errors:
    400 for 1–40 characters after trim, 400 `name_taken` for a duplicate in that month under the column's
    `utf8mb4_0900_ai_ci` collation, plus 401, 404 and 409 `month_ended`.
  - Undo of a removal whose name another category took meanwhile: decided there (014's note, per month).
  - `tech_name` and the Notion match never change.
- **Part 5 (038), add a category.**
  - `POST /api/ledgers/:id/months/:month/categories` takes `{ name }` and gives `201 CategoryDto`.
  - It reuses the live category with a matching name in any month, latest month first, then
    `categories.display_name`.
  - Otherwise it creates a category. Its `tech_name` is a slug of the name, made unique per ledger, deleted rows
    included (014's note). Its `sort_order` is the ledger's max + 10.
  - A removed row in that month is revived at €0, and its expenses stay deleted.
  - Errors: as for rename.
  - App: "Add a category" in the empty state and under the list.

## Not doing (YAGNI, part 1)

- **A `no_budget` error code.** `category_not_in_month` already refuses, and part 2's app reads the empty list (see
  Open questions).
- **Per-month names, planned amounts, add, the Budget tab:** parts 2–5.
- **Dropping `categories.deleted_at`, `categories.display_name` or `category_budgets`.** Each one still has a reader
  or a later part's use. The `2000-01` seed rows do go: they sit before every ledger's first month.
- **Writing out rows for categories deleted before 028.** They stay hidden by `categories.deleted_at` and nothing can
  bring them back.
- **Lists for months before a ledger's first month.** They have no budget, and they have ended, so they are
  read-only.
- **Locking expense writes against a removal** (028's follow-up, unchanged).
- **A client-side check of whether November has a budget** before part 2.
- **Updating conventions §3.** "Each month has its own category list" stays true (see Follow-ups).

## Risks

- **Migrate and deploy in the same Kyiv month.** 008 writes lists only up to its run date.
  - If a month starts between `yarn api migrate` and deploying slice 3's code, the old code lets that month inherit,
    so expenses get saved there.
  - After the deploy, that month has no rows, and those live expenses sit in a month with no list.
  - So migrate at deploy time. If a month boundary falls between the two, call
    `POST /api/ledgers/:id/months/<that month>/copy` for each ledger right after the deploy.
- **`INSERT … WITH RECURSIVE … SELECT` reading the table it writes.** `EXPLAIN` accepted it on the local MySQL
  (26.7.0), and MySQL buffers through a temporary table. Slice 1's test runs it on data. The proof that counts is
  CI's integration run on `mysql:8.0`, so migrating the real databases waits for green CI.
- **The migration test depends on the real date.** It asserts relative to `kyivToday(new Date())`, and skips
  `thisMonth + 1`, the only month the UTC+3 approximation can add. Ledger B's live expense proves the per-ledger
  bound without touching A.
- **The app has no way to set up a new month between part 1 and part 2** (Open questions). Until then a month can be
  set up with `POST …/months/:month/copy`. On 2026-10-31, if part 2 hasn't merged, November needs that call.
- **The web check must use this worktree's API** (slice 4). Before checking, confirm with `lsof -iTCP:3000 -sTCP:LISTEN`
  and `lsof -p <pid> | grep cwd` that the API runs from this checkout. Create the QA user with
  `yarn api create-user --username claude-qa-033 --email claude-qa-033@example.test`, and check that `GET /api/ledgers`
  lists only its ledger. Delete the user and ledger after the PR.
- **Integration tests skip silently without `DATABASE_URL_TEST`.** Slices 1–3 and 5 must show the migrations,
  categories and expenses suites as run.
- **Migrating the dev DB touches ledgers 1 and 2**: 45 rows added and 30 deleted.
  - From each ledger's first month on, the rows write out today's lists, and `main`'s carry-over code reads them the
    same way.
  - Earlier months lose their lists at once. For ledger 1 that is September and before; it has no expenses there.
  - Nothing calls Notion.
- **A ledger's first month comes from `ledgers.created_at` in the DB server's zone.**
  - New: it is the only part of the migration that depends on the server's zone.
  - Read as stored, that month is never later than the Kyiv month for a server at or west of Kyiv (the dev DB is CEST;
    UTC elsewhere is safe too). At worst a ledger gets one extra month.
  - A server east of Kyiv could start a ledger a month late, but only when the ledger also has no expense in its
    creation month. Before migrating the real DB, check with `SELECT @@global.time_zone, @@system_time_zone`.
- **The two statements change in one transaction.** A failure rolls back both, and the runner records nothing, so a
  rerun starts clean. The migration test proves both statements, and the second run's `[]`.

## Open questions

- **Decided (user, 2026-10-16): the 5-part split.** 033 is narrowed to part 1, and parts 2–5 become briefs 035–038
  as proposed. Rename comes before add. This plan is part 1 only.
- **Decided (user, 2026-10-16): timing.** Part 1 merges when ready, and part 2 is next. If part 2 is late, a manual
  `POST …/months/2026-11/copy` call covers November.
- **No.** A new ledger starts with the 15 defaults in its Kyiv month of creation. Earlier and later months start
  empty, as the migration leaves existing ledgers. Assumption meanwhile: as planned. The alternative is no list at
  all, set up with part 5's Add.
- **No.** "No budget" means no live category in the month. Removing the last one brings the empty state back, and
  Copy then works there; the removed rows' Undo answers 404 after a copy. Assumption meanwhile: as planned.
- **No.** An expense in a month with no budget gets the existing `400 category_not_in_month`, not a new code.
  Assumption meanwhile: no new code.
- **No.** Copy into a month that already has a budget is refused (`409 budget_exists`), not merged. A missing
  previous list gives `409 no_previous_budget`. Assumption meanwhile: these codes.
- **No.** The migration's "now" is UTC+3, and a month holding a live expense keeps its list even when it is after
  now. Assumption meanwhile: as planned.

## Follow-ups

- Conventions §3 could add "nothing carries over: a month without live rows has no budget (brief 033)". This is a
  proposal for part 2, not a slice here.
- 028's follow-up stands: drop `categories.deleted_at` once nothing reads it.
- 032's follow-ups stand: `linkParams.ts`'s stale `MONTH_RE` comment, `MONTH_RE` accepting `9999-12`, and the
  repeated 404 assertion in `expenses.int.test.ts`.

## Deviations

<filled by the developer during build>

- slice 3: "removes it and its expenses from that month only" keeps the 31 October clock instead of the default one — its 1 November expense would otherwise be refused as `date_in_future`.

## Revision 1

- Skeptic #10 (required): a new risk, "Migrate and deploy in the same Kyiv month", and the Checked note on migrating
  the dev DB is qualified to match.
- Suggestions taken:
  - slice 4 drops the unused `addDays`/`shiftMonth` imports;
  - slice 3 fixes the stale carry-over wording in `restoreToMonth`'s JSDoc and the `inMonth` comment;
  - the EXPLAIN risk names CI's `mysql:8.0` run as the proof;
  - slice 4 stays right after slice 3.
- User decisions (2026-10-16) recorded: the 5-part split (briefs 035–038), and the timing. Neither is open any more.

## Revision 2 (Gate A, user, 2026-10-16)

- **Decision:** migration 008 writes each ledger's lists from that ledger's first month, not from 2000-01. The first
  month is the earlier of the month of `ledgers.created_at` and the month of the ledger's earliest expense, soft-deleted
  ones included. Months before it have no budget.
- What changed in this plan:
  - Slice 1's SQL: `bounds` gains `first_month`, and the `months` anchor is the earliest first month. A second
    statement deletes rows before each ledger's first month (the `2000-01` seed). Both statements run in one
    transaction.
  - The test: ledger A's first month comes from a deleted expense before its `created_at`, ledger B's from
    `created_at`. Both are empty before their first month, and no `2000-01` rows are left. Slice 1 is now about 125
    lines, and part 1 about 400 added.
  - The dev DB dry run: 45 rows added and 30 deleted, instead of 9,630 added.
  - Smoke check, AC row, Not doing and Risks are updated to match.
  - One new risk: `created_at` is in the DB server's zone.
- Unaffected: the 003 migration test. Its ledger is created at the real date, with an expense on 2026-10-01, so
  October 2026 still lists its 15 categories.
- Status set to approved.

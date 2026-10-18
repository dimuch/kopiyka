# Plan: Rename a category in one month, API (part 4 of 5 of 033)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (outline: ../033-monthly-budget/plan.md, "Later parts", Part 4; notes: ../014-create-and-rename-categories/brief.md)
Branch: feat/rename-category-in-month
Base: origin/main @ f7a45a8 (parts 1–3, 033/035/036, merged)

This plan is PR A, the API, in 4 slices of about 335 changed lines. The app part (a rename modal and a Budget row
button) is a new brief, 040, built from `main` after this PR merges. It is outlined under
[Later part (brief 040)](#later-part-brief-040-app-outline). See Decisions.

## Decisions (user, 2026-10-18)

1. **Split accepted.** This brief, branch and PR are the API only (slices 1–4). The app moves to a new brief, 040
   (039 is taken by the loader chore, `docs/features/039-category-month-loader`), built from `main` after this PR merges. 037's app ACs (web 390×844, iPhone) map to 040.
2. **Undo rule confirmed.** Restoring a removed category whose name another live category in that month now has is
   refused with `409 name_taken`. Nothing is written, and the removal's stamp is kept, so the same Undo works once the
   name is free again.
3. **`display_name` gets `DEFAULT ''`**, so older code sharing the DB keeps working. That covers the parallel chore
   session's API on the dev DB, and production between migrate and deploy. Reads treat an empty month name as
   missing and fall back to `categories.display_name`. A test proves that a row written without a name, as old code
   writes it, reads as the category's own name.

## Approach

**Names move to the month row.** Migration 009 adds `category_months.display_name` (default `''`), filled from
`categories.display_name`. A rename updates one row, so other months keep their names, and copy copies the source
rows' names. `categories.display_name` stays, as the fallback for two cases: a month before a category's first row,
and a row old code wrote without a name. `tech_name` is never written, so tile colours and the Notion sync (which
match on `tech_name`) don't change.

**Reads.** One SQL fragment, `NAME_IN_MONTH` in `monthLists.ts`, names category `c` in a month. It takes the name on
the category's row with the latest `list_month` on or before that month, removed or not. An empty name counts as
missing. Without one it falls back to `categories.display_name`. The list uses it, and so does `GET one`:

- In the list, the month's own live row always exists, so the list shows the month's name.
- `GET one` for a month without the category shows that month's removed row's name, else the latest earlier month's,
  else the category's.

The DTOs don't change, so every app screen that shows a name already follows the month.

**Rename.** `PUT …/categories/:categoryId/months/:month/name` runs `renameInMonth` under 029's `lockLedger`, in three
steps:

1. It checks the category is in the month's list, else 404.
2. It checks that no other live category in that month has the name, else `400 name_taken`. The comparison uses each
   row's effective name, so a row written without a name still counts.
3. It writes the trimmed name on that month's row.

"Ignoring case" is the column's `utf8mb4_0900_ai_ci`, which also ignores accents ("Café" = "cafe"), as 014 noted. The
collation is declared on the column, so it doesn't depend on the server's default. Removed rows don't block a name
(014: deleted categories don't block reuse).

**Undo with a taken name** (Decision 2). Restore checks the removed row's effective name in the same way, and refuses
with `409 name_taken` before writing. Such a clash only arises when, after a removal, another category in the same
month was renamed to the removed one's name. The app's Undo bar already shows "Couldn’t undo" on any failure.

Alternatives considered:

- **Undo, other rules:**
  - Restore and add a suffix ("groceries 2"). This silently renames something the user chose, and needs more code.
  - Let removed rows block a rename. Then Undo can never collide, but "You already have a category called “groceries”"
    would point at a category the user can't see in that month.
- **No DEFAULT on the column**, so a writer that forgets the name fails loudly. Rejected by the user (Decision 3):
  older code sharing the DB must keep working.

## Contracts

- **DB: `apps/api/migrations/009_category_month_names.sql`**

  ```sql
  -- Brief 037. A category's name is per month: a rename in October leaves September's name as it was, and a copy takes
  -- the source month's names. Every row starts with its category's current name. '' (what code from before 037 writes,
  -- not knowing the column) means "no name of its own": reads fall back to categories.display_name, which also names
  -- a category in a month before its first row. tech_name (tile hue, Notion match) never changes. Names in a month are
  -- unique ignoring case and accents; the collation is declared so it doesn't depend on the server's default.
  ALTER TABLE category_months
    ADD COLUMN display_name VARCHAR(100) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT ''; -- 'eating out', this month's name

  UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
     SET m.display_name = c.display_name;
  ```

  Checked on the local test DB (MySQL 26.7.0), with temporary tables:
  - **Adding the column:** works on a table with rows, which hold `''` until the `UPDATE`.
  - **Matching:** `display_name = ?` matches `'cafe'` for `'Café'`. It doesn't match `'CAFE '` (the collation is NO
    PAD; Zod trims first).
  - **The read fragment:** `COALESCE(NULLIF((SELECT … LIMIT 1), ''), c.display_name)` names a `''` row by its
    category's name, and a named row by its own.
  - **Mixed collations:** `COALESCE(NULLIF(m.display_name, ''), c.display_name) = ?` works even when `c.display_name`
    has a different collation.

- **Writers of `category_months`** (all in slice 1) now write the name. Older code that omits it gets `''`, which
  reads correctly.
  - `admin.ts` `createUserWithLedger`: `INSERT INTO category_months (category_id, list_month, display_name) SELECT category_id, ?, display_name FROM categories WHERE ledger_id = ?`.
  - `monthLists.ts` `copyPreviousMonth`: insert `(category_id, list_month, display_name)` and select
    `m.display_name`, so a copy takes the source month's names. A `''` source copies as `''` and still falls back.
  - `test/helpers.ts` `storeMonthList`: the same, from `categories.display_name`.

  Migrations 007 and 008 are merged and stay as they are.

- **API, `apps/api/src/categories/monthLists.ts`:**

  ```ts
  /**
   * SQL naming category `c` in a month (brief 037): the name on its row with the latest list_month on or before the
   * month, removed or not; '' (a row written before 037) or no row falls back to categories.display_name. The month's
   * first day ('YYYY-MM-01') is the next param.
   */
  export const NAME_IN_MONTH = `COALESCE(NULLIF((SELECT m.display_name FROM category_months m
                                                   WHERE m.category_id = c.category_id AND m.list_month <= ?
                                                   ORDER BY m.list_month DESC LIMIT 1), ''), c.display_name)`;

  /** A month row's effective name: its own, or its category's when it has none (''). Aliases `m` and `c`. */
  const ROW_NAME = `COALESCE(NULLIF(m.display_name, ''), c.display_name)`;

  /** True when another live category of the ledger is called `name` in the month (first day), ignoring case and accents. */
  async function nameTaken(
    conn: PoolConnection,
    ledgerId: number,
    first: string,
    name: string,
    categoryId: number,
  ): Promise<boolean>;
  // SELECT 1 FROM category_months m JOIN categories c ON c.category_id = m.category_id
  //  WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ?
  //    AND m.category_id <> ? AND ${ROW_NAME} = ? LIMIT 1

  /**
   * Renames a category in a 'YYYY-MM' month only (brief 037); `name` is already trimmed. 'not_found', writing nothing,
   * when it isn't in the month's list; 'name_taken' when another category there has the name.
   */
  export async function renameInMonth(
    db: Db,
    ledgerId: number,
    categoryId: number,
    month: string,
    name: string,
  ): Promise<'renamed' | 'not_found' | 'name_taken'>;
  ```

  `renameInMonth` works inside `withTransaction`:
  1. `lockLedger`.
  2. The same in-list `SELECT 1 … AND ${inMonthList('?')}` as `setPlanned`. No row → `'not_found'`.
  3. `nameTaken(…, categoryId)` → `'name_taken'`. The category's own row is excluded, so "Rent" for rent works.
  4. `UPDATE category_months SET display_name = ? WHERE category_id = ? AND list_month = ? AND deleted_at IS NULL`.

  `restoreToMonth` changes its return type from `Promise<boolean>` to
  `Promise<'restored' | 'not_found' | 'name_taken'>`.
  - Its first `SELECT` also reads `${ROW_NAME} AS name`.
  - After it finds the removed row, `nameTaken(conn, ledgerId, first, row.name, categoryId)` returns `'name_taken'`
    before anything is written.
  - Its JSDoc says so.

  `ROW_NAME` has these two callers (`nameTaken` and `restoreToMonth`), and 038's add will be the third.

- **API, `apps/api/src/categories/routes.ts`:**
  - **List SQL:** select `${NAME_IN_MONTH} AS display_name` in place of `c.display_name`. Params become
    `[first /* name */, first /* b */, ledgerId, first /* inMonthList */]`.
  - **GET one SQL:** the same. Params become `[first /* name */, first /* in_month */, first /* b */, first, next, categoryId, ledgerId]`.
    `EXPLAIN` on the test DB, with `ONLY_FULL_GROUP_BY` on, accepted the correlated subquery under `GROUP BY c.category_id`.
  - `CategoryDto`, `CategoryWithTotalsDto` and `toDto` don't change. The `displayName` JSDoc gains "the month's name (brief 037)".
  - **Body schema:** `const NameBody = z.object({ name: z.string().trim().min(1).max(40) });`. Checked against the
    repo's Zod 4.6.5:
    - it trims before checking, so `'   '` fails and `'  food out  '` becomes `'food out'`;
    - `max(40)` counts code points: 40 emoji pass and 41 fail;
    - a number or a missing body fails.
  - **`PUT /api/ledgers/:id/categories/:categoryId/months/:month/name`**, body `{ "name": "food out" }`. Guards:
    `requireAuth`, `requireLedger`. Steps, in order:
    1. `MonthParams.parse(req.params)` and `NameBody.parse(req.body)`: either failing gives 400 `invalid_request`.
    2. `monthEnded(month, now())` gives 409 `month_ended`.
    3. `renameInMonth(…)`:
       - `'not_found'` → 404 `not_found`;
       - `'name_taken'` → 400 `name_taken`;
       - `'renamed'` → 204.

    No session gives 401, and a non-member gives 404 (the guards).

  - **`POST …/months/:month/restore`:** `'not_found'` → 404, `'name_taken'` → **409 `name_taken`**, `'restored'` → 204.
    It is 409 rather than 400 because the request is well formed, and the clash is with the month's current state.

- **App:** none in this PR. `apps/mobile/src/api/types.ts` doesn't change, because `displayName` keeps its shape and
  now carries the month's name.
- **Consumers:**
  - Every app screen showing a category name already reads the list's or `GET one`'s `displayName`.
  - Brief 040's modal calls the PUT.
  - 038's add will reuse `nameTaken` and `ROW_NAME`.
- **New dependencies:** none.

## Slices

- [x] 1. Store each category's name per month, starting from its current name
  - Files:
    - `apps/api/migrations/009_category_month_names.sql` (new);
    - `apps/api/src/admin.ts`;
    - `apps/api/src/categories/monthLists.ts` (`copyPreviousMonth`'s insert);
    - `apps/api/test/helpers.ts` (`storeMonthList`);
    - `apps/api/test/migrations.int.test.ts`.
  - Change: the migration and the three writers, as in Contracts. Reads don't change yet, so the API answers as
    before. About 75 lines.
  - Tests, all in `migrations.int.test.ts`:
    - `oldSchema`'s file list gains `'008_months_stand_alone.sql'`.
    - **The 008 test moves to a temp dir, as 007's did.** It copies `008_months_stand_alone.sql` into its `dir` and
      runs `runMigrations(TEST_DB_URL!, dir)`, still expecting `['008_months_stand_alone.sql']` and then `[]`. Run
      against the real dir it would now also apply 009.
    - **"starts a new ledger with the defaults in its own Kyiv month" moves** from the 008 describe into the new 009
      one. `createUserWithLedger` now writes `display_name`, a column the 008-only schema lacks. It also asserts the
      15 rows' names equal `DEFAULT_CATEGORIES`' `displayName`s.
    - New `describe('009_category_month_names (MySQL)')`, case "starts every month's name as its category's name".
      It sets up the schema with `oldSchema('008_months_stand_alone.sql')`, then:
      - `rawUser` with rent, eating_out and gym.
      - `UPDATE categories SET display_name = 'Eating Out'` for eating_out, so the copy is shown to be exact.
      - Raw rows for 2026-09 and 2026-10 for all three. eating_out's October row is removed (stamp
        `'2026-10-05 10:00:00'`).
      - Copy 009 into `dir`: `runMigrations(TEST_DB_URL!, dir)` gives `['009_category_month_names.sql']`, then `[]`.

      Expected: all 6 rows as `{ tech_name, list_month, display_name, deleted_at }`, with
      `'rent' / 'Eating Out' / 'gym'` in both months. The removed row keeps its stamp. An
      `INSERT INTO category_months (category_id, list_month)` that omits the name, as old code does, succeeds and
      stores `''`.

    - The existing copy cases in `categories.int.test.ts` keep passing.

- [x] 2. Show each category under its name in the month asked for
  - Files:
    - `apps/api/src/categories/monthLists.ts` (`NAME_IN_MONTH`);
    - `apps/api/src/categories/routes.ts` (list and GET one SQL and params, JSDoc);
    - `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. About 60 lines.
  - Tests, in `categories.int.test.ts`. Names are set with raw SQL, because the endpoint comes in slice 3.
    - In `month lists`, new case "names each category as its month does". It runs
      `UPDATE category_months SET display_name = 'food out'` on eating_out's October row, then checks:
      - list 2026-10: eating_out is `'food out'`, `techName: 'eating_out'`;
      - list 2026-09: `'eating out'`;
      - GET one `?month=2026-10`: `'food out'`; `?month=2026-09`: `'eating out'`;
      - `?month=2026-12` (no rows after October): `'food out'`, the latest earlier month;
      - `?month=2026-08` (before its first row): `'eating out'`, from `categories`;
      - after `removeFrom(eating_out)`, `?month=2026-10` gives `'food out'` with `inMonth: false`.
    - In `month lists`, new case "reads a row written without a name, as code from before 037 writes it, as its
      category's name" (Decision 3). It inserts November's rows with
      `INSERT INTO category_months (category_id, list_month) SELECT category_id, '2026-11-01' FROM categories WHERE ledger_id = ?`,
      leaving the name out. Then:
      - the 2026-11 list gives every `displayName` equal to its category's (`'eating out'`, `'Sviat'`…), none `''`;
      - GET one eating_out `?month=2026-11` gives `'eating out'`;
      - a raw October rename to `'food out'` doesn't leak into November: November's `''` row falls back to
        `categories`, not to the earlier month.
    - In `copy the previous month`, new case "names the copy as the month it came from". It does the same raw
      October rename, then `copy('2026-11')`: November's eating_out is `'food out'`, and September's is still
      `'eating out'`.

- [x] 3. Rename a category in one month
  - Files:
    - `apps/api/src/categories/monthLists.ts` (`ROW_NAME`, `nameTaken`, `renameInMonth`);
    - `apps/api/src/categories/routes.ts` (`NameBody`, the PUT);
    - `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts. About 165 lines, about 110 of them tests. This is just over the slice target; the
    validation and uniqueness cases belong together.
  - Tests:
    - **Helpers.** Move the `copy` helper from `describe('copy the previous month')` up to the suite level, next to
      `plan`, so the rename describe's copy case can call it.
    - A new `describe('rename in a month')` with a helper
      `rename(categoryId, headers = auth, ledgerId = owner.ledgerId, month = '2026-10', name: unknown = 'food out')`.
      It is shaped like `plan`, and its positional order (id, headers, ledgerId, month, name) is kept so it fits the
      guards table.
    - A `nameOf(month)` helper maps techName to displayName from the list.

    Cases:
    - **"renames it in that month only"**, setup: `addSpend('car', '2026-10-02', '60.00')`. Rename eating_out to
      `'  food out  '` → 204. Checks:
      - October: `'food out'`, and September: `'eating out'` (the AC);
      - GET one `?month=2026-10`: `'food out'`, `techName: 'eating_out'`;
      - `SELECT tech_name, display_name FROM categories` for it is unchanged;
      - Notion: rename car to `'auto'`; `loadUncounted(db, { ledgerId, year: 2026 })` still gives `techName: 'car'`
        (033's note);
      - renaming rent to `'Rent'` (its own name in another case) → 204 and shows `'Rent'`.
    - **"a later copy takes the source month's names and stays apart"**: rename eating_out in October to
      `'food out'`, then `copy('2026-11')`, so November shows `'food out'`. Then rename it in November to
      `'restaurants'`: October is still `'food out'`.
    - **"rejects an empty or too long name, changing nothing"**:
      - each of `''`, `'   '`, `'x'.repeat(41)`, `123` and `null`, plus a request with no body, gives 400
        `invalid_request`;
      - a malformed month (`'2026-13'`) also gives 400;
      - every name stays as it was;
      - `'x'.repeat(40)` gives 204.
    - **"refuses a name another category has in that month, ignoring case and accents"**:
      - gym → `'RENT'` gives 400 `{ error: 'name_taken' }`, and so does gym → `'Grocéries'`. gym keeps its name.
      - A row without a name of its own still blocks (Decision 3): November is stored by raw SQL without names, as
        in slice 2. There, gym → `'rent'` gives 400 `name_taken`, and gym → `'food'` gives 204.
      - A removed row doesn't block: after `removeFrom(eating_out)`, gym → `'eating out'` in October gives 204.
      - Another month's name doesn't block: in November, rename eating_out to `'food out'`. Then gym → `'eating out'`
        in November gives 204, while October still has its own eating out.
    - **"answers 404 for a category not in that month's list, changing nothing"**: the same five cases as 036's
      planned-amount test (removed, a month with no budget, `categories.deleted_at`, 999999, the stranger's rent).
    - **"refuses a month that has ended in Kyiv, changing nothing"**: 2026-09 gives 409 `month_ended`, and
      September's name is unchanged.
    - **Guards:** add `['rename in month', rename]` to the `describe.each` guards table, for 401, the non-member 404
      and 400 for a non-numeric id.

- [x] 4. Refuse an Undo that would bring back a name now taken in that month
  - Files: `apps/api/src/categories/monthLists.ts` (`restoreToMonth`), `apps/api/src/categories/routes.ts` (the
    restore route), `apps/api/test/categories.int.test.ts`.
  - Change: as in Contracts (Decision 2). About 35 lines.
  - Tests, in `restore to a month`, new case "refuses to bring back a name another category took meanwhile, until it's
    free again" (Prove-It: without the check the restore gives 204):
    1. `addSpend('eating_out', '2026-10-03', '15.00')`, then `removeFrom(eating_out)`.
    2. Rename gym to `'Eating Out'` → 204.
    3. `restoreTo(eating_out)` gives 409 `{ error: 'name_taken' }`. The October list still lacks eating_out, and the
       expense still has the removal's stamp.
    4. Rename gym back to `'gym'`, then `restoreTo(eating_out)` gives 204, and the expense is live again.

    The existing restore cases keep passing.

Estimated total: about 335 changed lines (1: 75, 2: 60, 3: 165, 4: 35).

## AC → evidence

The two app ACs map to brief 040; this PR has no UI change.

| AC (brief 037)                                                                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Migration: each month's name starts as the category's current name                                                      | `migrations.int.test.ts` → "009 … starts every month's name as its category's name" (removed rows too), and the moved new-ledger case with names (slice 1). Slice 2's "reads a row written without a name…" covers the `DEFAULT ''` fallback (Decision 3).                                                                                                                                                                 |
| 2. API rename: happy, 400 empty/long, 400 duplicate, 409, 401, non-member 404; September keeps its name; copy takes source | `categories.int.test.ts` → `rename in a month`: "renames it in that month only" (September keeps), "rejects an empty or too long name", "refuses a name another category has…" (`name_taken`), "refuses a month that has ended", "answers 404…", and the `rename in month guards` row (401, 404). Copy: slice 2's "names the copy as the month it came from" and slice 3's "a later copy takes the source month's names…". |
| 3. API: Undo of a removal whose name is now taken does what the plan decides                                               | Decision 2: 409 `name_taken`, nothing written, stamp kept. `categories.int.test.ts` → "refuses to bring back a name another category took meanwhile, until it's free again" (slice 4).                                                                                                                                                                                                                                     |
| 4. App (web 390×844): renaming shows on Budget, Expenses tab, Category screen and expense form, that month only            | **Brief 040.** In this PR the reads change, and the existing screens show whatever the list or `GET one` gives.                                                                                                                                                                                                                                                                                                            |
| 5. iPhone (Expo Go): rename works                                                                                          | **Brief 040.**                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6. Gates green, integration tests ran                                                                                      | `yarn format:check && yarn lint && yarn typecheck && yarn test` on every slice. The PR records that `migrations.int` and `categories.int` ran (not skipped).                                                                                                                                                                                                                                                               |
| Brief: `tech_name` and Notion don't change                                                                                 | Slice 3's "renames it in that month only" (the `categories` row is unchanged, and `loadUncounted` still gives `'car'`). No Notion code changes.                                                                                                                                                                                                                                                                            |
| Brief: ended months can't change                                                                                           | Slice 3's 409 case. Brief 040 hides the control in an ended month.                                                                                                                                                                                                                                                                                                                                                         |

## Later part (brief 040, app, outline)

Brief 040 is `../040-rename-category-in-app/brief.md` (added with this plan). It is built from `main` after this PR merges, and its
own plan may change details.

- **A `/rename-category?categoryId=&month=` modal** (`apps/mobile/src/app/rename-category.tsx`), registered in
  `_layout.tsx` as `presentation: 'modal'`. It is shaped like `planned-amount.tsx`:
  - It loads the category with the same states. If `chore/category-month-loader` has merged, it uses that shared
    loader; otherwise it copies one.
  - It shows a labelled name field starting at the current name, and Save.
  - A client check (trimmed, 1–40 code points, `[...name].length`) gives "A name needs 1 to 40 characters.".
  - Error texts:
    - `name_taken` gives the brief's text, `You already have a category called “groceries” in November.`;
    - `409 month_ended` and `404` give 036's texts, and hide Save.
- **`data/categories.ts`** gains `renameInMonth(ledgerId, categoryId, month, name): Promise<void>`, which PUTs
  `{ name }`.
- **The Budget tab:** each row outside an ended month gets a trailing 44×44 pencil button (a new `edit` glyph in
  `Icon.tsx`) that opens the modal. The row's own tap still opens the planned amount (036). Ended months have no
  button.
- **ACs 4 and 5 of 037 move here.** On web at 390×844 as QA user `claude-qa-040`:
  - the name changes on the Budget tab, Expenses tab, Category screen and expense form for that month only;
  - other months and a copy behave as this PR's tests show;
  - an ended month has no control.

  The user checks rename on iPhone.

- **About 250 lines.**

## Not doing (YAGNI)

- **The app** (brief 040), add a category (038) and reorder (015).
- **Updating `categories.display_name` on a rename.** It's only the fallback, for months before a category's first
  row and for rows written without a name. Writing it would make "other months keep their names" depend on which month
  was renamed last.
- **Backfilling `''` rows that old code writes after the migration.** Reads fall back, and a rename gives the row its
  own name.
- **A DB unique index on names per month.** `category_months` has no `ledger_id`, removed rows mustn't block, and
  `''` rows need the fallback. The check runs under `lockLedger`, like every other list rule.
- **A specific Undo failure text for `name_taken`.** The bar's "Couldn’t undo" + Retry covers it (Follow-ups).
- **Returning the renamed category from the PUT.** Screens reload on focus, so 204 is enough.
- **Dropping `categories.display_name`.** It is the fallback, and 038's lookup reads it.
- **Rejecting invisible names.** `NameBody`'s `.trim()` strips whitespace but not a zero-width space (U+200B), so a
  name made only of zero-width spaces passes as 1–40 characters. Nothing in the brief asks for more. It's left as is.

## Risks

- **Old code sharing the DB** (Decision 3). After 009 is applied, `main` from before this PR still works:
  - its Copy and create-user insert rows without a name, which get `''`;
  - this PR's reads name those rows by `categories.display_name`, which is exactly what old code shows;
  - its reads ignore the column.

  This covers the parallel chore session's API on the dev DB, and production between migrate and deploy. Slice 2's
  "reads a row written without a name…" and slice 3's "A row without a name of its own still blocks" prove it. One
  limit: a copy made by old code doesn't take the source month's renamed names. That can't happen in practice,
  because old code has no rename.

- **009 is two statements, and `ALTER` auto-commits.** If the `UPDATE` failed, rows would keep `''`, which reads
  correctly through the fallback. `schema_migrations` would record nothing, so a rerun fails on the existing column;
  fix forward by hand. Slice 1's test runs it on data, and CI runs it on `mysql:8.0`. The dev DB gains names on 45
  rows of ledgers 1 and 2 (checked read-only), and nothing calls Notion.
- **Collation on CI and production.**
  - The column declares `utf8mb4_0900_ai_ci`, so a named row's comparison holds whatever the server's default.
  - The connection's collation (`utf8mb4_unicode_ci` from mysql2) loses to the column's, because a column outranks a
    parameter in MySQL's coercibility rules.
  - A `''` row compares through `categories.display_name`. On dev and CI that column is `utf8mb4_0900_ai_ci` too, and
    the mixed case ran locally without error.
  - Before migrating production, check `SHOW FULL COLUMNS FROM categories LIKE 'display_name'`.
  - Slice 3's `'Grocéries'` case on CI proves the rule.
  - Side effects of this collation: "ß" equals "ss", and Ukrainian "ґ" equals "г" ("ї" ≠ "і"), all checked locally.
- **The correlated name subquery in GET one under `ONLY_FULL_GROUP_BY`.** `EXPLAIN` accepted it locally, and slice
  2's tests on CI prove it. Fallback, about 3 lines: `LEFT JOIN` the month's own row, and use the subquery only in the
  list.
- **Overlap with the parallel loader extraction** (`chore/category-month-loader`). None in this PR, which touches no
  app file. Brief 040 handles it.
- **Size: about 335 lines**, within the limit. Slice 3 (about 165) is over the slice target, for the reason given
  there.
- **Integration tests skip silently without `DATABASE_URL_TEST`.** The PR must show `migrations.int` and
  `categories.int` as run.

## Open questions

- **Decided (user, 2026-10-18): the split, the Undo rule and `DEFAULT ''`.** See Decisions.
- **No: "unique ignoring case" also ignores accents** (`utf8mb4_0900_ai_ci`, as 014 asked the plan to state). Assumed
  intended: "Café" and "cafe" can't both exist in a month.
- **No: "1–40 characters" counts Unicode code points** (Zod 4's `max`). An emoji counts as 1, a flag emoji as 2.
  Assumed fine.
- **No: `GET one` for a month where the category was removed shows that month's (removed) row's name.** That's the
  name its Undo would bring back.

## Follow-ups

- Conventions §3 could add "a category's name is per month (`category_months.display_name`, brief 037)", next to
  033's proposed "nothing carries over" note. This is a proposal, not a slice.
- The Undo bar could explain a refusal ("Another category is called “eating out” now"), if `name_taken` turns out to
  happen.
- 036's follow-up stands: the shared "category in a month" loader (the parallel chore PR).
- 033's and 035's follow-ups stand: `linkParams.ts`'s `MONTH_RE` accepting `9999-12`.

## Deviations

- Size: ~423 code and test lines against ~335 (1.26×), from fuller tests.
- Tests: the name helper is `namesIn` (added in slice 2, used by slice 3) instead of slice 3's `nameOf`; the "another
  month's name doesn't block" case uses rent → housing and car → rent in November.
- Review: `ROW_NAME` declares `COLLATE utf8mb4_0900_ai_ci`, so the uniqueness check doesn't depend on
  `categories.display_name` having the same collation as the new column (production's default may differ).

## Revision 1 (user decisions, 2026-10-18)

- **The plan is now PR A only** (slices 1–4, unchanged in number). The app slices 5–6 became the outline
  "Later part (brief 040)", and ACs 4 and 5 map there.
- **The Undo rule is confirmed** as planned (Decision 2).
- **009 uses `DEFAULT ''`.**
  - `NAME_IN_MONTH` treats `''` as missing (`NULLIF`).
  - `nameTaken` and restore compare the effective name (`ROW_NAME`).
  - The migration test asserts that an insert without a name stores `''`, in place of the earlier rejection.
  - Slice 2 adds the "row written without a name" test, and slice 3 adds a matching uniqueness assertion.
  - Risks: the old-code entry now says old code keeps working.
- **New estimate: about 335 lines** (slice 2: 50 → 60; slice 3: 160 → 165).

## Revision 2 (skeptic: approve with edits)

- The app brief is now **040**, with QA user `claude-qa-040`. 039 is taken by the loader chore
  (`docs/features/039-category-month-loader`). References to `chore/category-month-loader` are unchanged.
- Slice 3's tests move the `copy` helper to the suite level, next to `plan`. The `rename` helper keeps its positional
  order (id, headers, ledgerId, month, name).
- New Follow-up: write brief 040 and point 037's brief at it.
- New Not doing entry: a name made only of zero-width spaces passes `NameBody`.
- Status: skeptic-approved.

# Plan: Remove hidden categories

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/remove-hidden-categories
Base: origin/main @ f6fc4b8

## Approach

A forward-only migration drops `categories.is_active` and adds a nullable `categories.deleted_at`. Dropping the column
is what brings hidden categories back: nothing filters on it any more, so no `UPDATE` is needed first. The two API
reads that filtered `is_active = 1` (the categories list with its quick row, and `checkCategory` for create/move) now
filter `deleted_at IS NULL`. The month list also skips expenses whose category is deleted. The PUT special case
("staying in a since-hidden one is fine") goes away: the category is always checked. In the app, the expense form loses
its stand-in category, and `splitQuick` loses the `byId` parameter that only existed for that stand-in.

Nothing writes `categories.deleted_at` yet. Brief 013 adds delete and restore. Tests set the column directly, the same
way the `is_active` tests did.

Alternatives considered:

- **Drop `is_active` only and add `deleted_at` in 013.** That is stricter YAGNI, but it goes against the brief's
  migration bullet ("replaces `is_active` with soft-delete state"). It would also push 013 to about 500 lines, past the
  ~400 limit.
- **Keep `ExpenseDraftData.categoryById` as a plain lookup.** Its only reason was the stand-in. The one other use, the
  "Added … to <category>" note, is a `categories.find`.

## Contracts

- DB: `apps/api/migrations/003_category_soft_delete.sql`:

  ```sql
  -- Categories are never hidden any more (brief 012): dropping is_active brings every hidden category back with its
  -- expenses. A category is soft-deleted instead, like an expense.
  ALTER TABLE categories
    DROP COLUMN is_active,
    ADD COLUMN deleted_at DATETIME NULL; -- soft delete, enables Undo; NULL = live
  ```

  No index: every query on `categories` already narrows by `ledger_id` (the `UNIQUE (ledger_id, tech_name)` prefix).

- API: no new endpoints. Request and response shapes don't change. Behaviour changes:
  - `GET /api/ledgers/:id/categories` → `{ categories, quickCategoryIds }` lists only `deleted_at IS NULL` categories.
    `quickCategoryIds` is picked from those (`pickQuick` is unchanged).
  - `GET /api/ledgers/:id/expenses?month=…[&categoryId=…]` leaves out expenses whose category has `deleted_at` set.
  - `POST /api/ledgers/:id/expenses` with a deleted category's id → `400 { error: 'unknown_category' }` (before, this
    applied to a hidden one).
  - `PUT /api/ledgers/:id/expenses/:expenseId` always checks `categoryId`, even when it is unchanged. A deleted
    category → `400 { error: 'unknown_category' }`. A missing expense is still checked first (`404 not_found`).
  - Unchanged: GET one, DELETE and restore of a single expense don't look at the category's state. In 013 a category's
    expenses are deleted together with it, and 013's brief asks its plan to decide the restore edge case.
- App:
  - `apps/mobile/src/data/quick.ts`:
    `splitQuick(quick: number[], categories: Category[]): { quick: Category[]; more: Category[] }`. Ids that are not
    in `categories` are dropped from `quick`.
  - `ExpenseDraftData` (`apps/mobile/src/data/useExpenseDraft.ts`) loses `categoryById`. The other fields stay.
  - DTO mirrors (`api/types.ts`) don't change.
- Tests: `resetSchema(migrationsDir?: string)` in `apps/api/test/helpers.ts` is passed through to `runMigrations`. Its
  one new caller is the migration test.
- New dependencies: none.

## Slices

- [x] 1. Replace hidden categories with soft-deleted ones in the API
  - Files: `apps/api/migrations/003_category_soft_delete.sql` (new), `apps/api/src/categories/routes.ts`,
    `apps/api/src/expenses/routes.ts`, `apps/api/test/helpers.ts`, `apps/api/test/migrations.int.test.ts` (new),
    `apps/api/test/categories.int.test.ts`, `apps/api/test/expenses.int.test.ts`
  - Change:
    - Add the migration above.
    - `categories/routes.ts`: `c.is_active = 1` becomes `c.deleted_at IS NULL`.
    - `expenses/routes.ts`:
      - `checkCategory`'s SQL becomes `deleted_at IS NULL`, and its JSDoc becomes "unless the category is a live
        (not deleted) one in this ledger".
      - PUT calls `checkCategory` unconditionally. Drop the since-hidden comment.
      - The month list adds `AND c.deleted_at IS NULL` to its `WHERE`.
    - `helpers.ts`: `resetSchema(migrationsDir?)`.
  - Tests:
    - `migrations.int.test.ts` (new, `describe.skipIf(!(await testDbReachable()))`), "brings hidden categories back
      with their expenses and drops is_active":
      1. Copy `001_initial.sql` and `002_exchange_rates.sql` from `MIGRATIONS_DIR` into a `mkdtemp` dir under
         `os.tmpdir()`, then `resetSchema(thatDir)`.
      2. `makeUser`, then `UPDATE categories SET is_active = 0` for `gym`, and insert one `gym` expense dated
         2026-10-01.
      3. `runMigrations(TEST_DB_URL!)` returns a list containing `'003_category_soft_delete.sql'`. A second call
         returns `[]`.
      4. `SHOW COLUMNS FROM categories` has `deleted_at` and no `is_active`.
      5. Through `buildApp` + `authHeader`: `GET …/categories` has 15 categories including `gym`, and
         `GET …/expenses?month=2026-10` returns the `gym` expense.
      6. `afterAll` removes the temp dir and closes the app and pool.
    - `categories.int.test.ts`: replace "hides inactive categories" with "leaves deleted categories out of the list and
      the quick row".
      - Add a `gym` expense, then set `gym`'s `deleted_at` to the clock.
      - Expect 14 categories with no `gym`.
      - Expect `quickCategoryIds` to equal the first 5 listed ids. Without the filter, `gym` would lead the row.
    - `expenses.int.test.ts`:
      - POST: "rejects a category from another ledger or a deleted one" sets `deleted_at` instead of `is_active = 0`,
        and expects `[400, { error: 'unknown_category' }]`.
      - PUT: "keeps a since-hidden category but will not move into one" becomes "will not keep an expense in a deleted
        category or move it into one". Both PUTs expect `[400, { error: 'unknown_category' }]`.
        Plus one PUT moving that expense out of the deleted category into a live one expects 200 (the user's way out).
      - GET: new "leaves out expenses in a deleted category". With `car` deleted, the 2026-10 names are
        `['latest', 'first']`.
    - About 100 changed lines.
  - Verify: dev DB, only with the user's OK at Gate A and after a `mysqldump` of `kopiyka`:
    1. `yarn api migrate` prints `Applied: 003_category_soft_delete.sql`.
    2. Running it again prints `Database is up to date.`
    3. With `yarn api dev` (launch config `api`), Home on web lists the ledger's categories.
- [x] 2. Drop the hidden-category stand-in from the expense form
  - Files: `apps/mobile/src/data/quick.ts`, `apps/mobile/src/data/useExpenseDraft.ts`, `apps/mobile/src/app/expense.tsx`,
    `apps/mobile/test/quick.test.ts`
  - Change:
    - `splitQuick(quick, categories)` builds its own id map. Its JSDoc drops "may hold a hidden category" and says ids
      not in `categories` are dropped.
    - `toDraft` drops the stand-in block and `categoryById`. The `categories` doc becomes "The ledger's categories, as
      the API lists them".
    - `expense.tsx` calls `splitQuick(quick, draft.categories)` and gets the saved note's category name with
      `draft.categories.find((c) => c.categoryId === saved.categoryId)?.displayName ?? ''`.
  - Tests: `quick.test.ts` "splits categories into the quick row, in its order, and the rest" drops the hidden fixture.
    `splitQuick([3, 99, 1], categories)` gives quick `[3, 1]` ("99 isn't a listed category, e.g. a deleted one, so it's
    dropped") and more `[2, 4]`. About 40 changed lines.
  - Verify: web build (launch configs `web` + `api`) at 390×844:
    1. From a Category screen, open an expense. Its category tile is selected in the quick row, and "N more" lists the
       other categories with no duplicates and no "hidden category".
    2. Add an expense. The note reads "Added “…” to <category> · …".
    3. `rg -n -i "hidden" apps/mobile/src apps/api/src` finds only unrelated hits (`overflow: 'hidden'`, `aria-hidden`,
       the `PhoneColumn` comment).
    4. `rg -n is_active apps` finds only migrations `001` and `003` and the migration test.

## AC → evidence

| AC                                                                                                                                     | Evidence                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration: a hidden category becomes active with its expenses visible; `is_active` gone; soft-delete state added; fresh and dev DB run | `migrations.int.test.ts` "brings hidden categories back…" (slice 1). Fresh DB: every `*.int.test.ts` runs `resetSchema()` on an emptied DB. Dev DB: the manual `yarn api migrate` twice (slice 1), noted in the PR             |
| API: deleted categories out of list and quick row; their expenses out of month lists; create/move into one → 400                       | `categories.int.test.ts` "leaves deleted categories out of the list and the quick row"; `expenses.int.test.ts` GET "leaves out expenses in a deleted category", POST "…or a deleted one", PUT "…or move it into one" (slice 1) |
| API: the "staying in a since-hidden one is fine" rule is gone, with its comment and test                                               | `expenses.int.test.ts` PUT "will not keep an expense in a deleted category…" (the keep case is 400) (slice 1); the comment is removed in the slice 1 diff                                                                      |
| App: no since-hidden code remains; unit tests updated                                                                                  | `quick.test.ts` updated case (slice 2); the `rg` checks and the web check in slice 2                                                                                                                                           |
| Gates green                                                                                                                            | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit                                                                                                                                             |

## Not doing (YAGNI)

- Delete and restore endpoints, the confirm screen, and Undo (brief 013).
- Category checks in GET one, DELETE and restore of a single expense (013 decides, see Contracts).
- An `UPDATE categories SET is_active = 1` before the drop: it changes nothing that anything reads afterwards.
- An index on `categories.deleted_at`.
- Editing historical docs that mention since-hidden categories (`docs/audits/2026-10-architecture.md`, plans 004, 006
  and 010, brief 009). They record what was true then.
- Conventions §3 ("Soft delete for expenses"). It only becomes incomplete once categories can be deleted and undone, so
  it is noted in brief 013.

## Risks

- **Deploy order.** The old API code queries `is_active`, and the new code queries `deleted_at`, so either one fails
  against the other's schema. Between `migrate` and the API restart (a few seconds) prod returns 500s on category and
  expense reads and writes; acceptable for a two-user app, called out at Gate B. README has no deploy procedure. The PR's test plan will say to run `yarn api migrate`
  right before restarting the API. A slice can't prove this, so it is listed here for Gate B.
- **The migration is irreversible on the dev DB** (forward-only, the column is dropped). Slice 1 runs it only after the
  user's OK and a `mysqldump`.
- **The migration test empties the shared test DB.** That is safe only because `vitest.config.ts` has
  `fileParallelism: false` and every integration suite calls `resetSchema()` in `beforeAll`. Slice 1 proves it with a
  full `yarn api test`.
- **The migration test seeds through `createUserWithLedger` on the 002 schema.** That works today because its
  `INSERT INTO categories` doesn't name `is_active`, which slice 1 proves. A later brief that changes that insert must
  keep it valid on the 002 schema, or seed this test with raw SQL.
- **Hidden categories reappear on Home** in dev (and in prod, if any rows have `is_active = 0`). The brief intends
  this. Brief 013 gives the way to remove them.

## Open questions

- No: the category soft-delete column (and the AC on leaving deleted categories out) lands here rather than in 013. The
  brief's migration bullet asks for it, and it keeps 013 under about 400 lines. The trade-off is one PR in which
  nothing writes the column. Assumption: yes.
- No: with the PUT rule gone, an expense whose category is deleted can't be saved, even unchanged (400
  `unknown_category`, shown as "That category is no longer available."). After 013 such expenses are deleted along with
  their category. Assumption: that is intended.
- No: the first AC's wording adds "and categories have soft-delete state instead", taken from the brief's "What"
  bullet. The third AC (the PUT rule) also comes from "What".
- Yes, for the dev-DB check only: OK to run the forward-only migration on the dev DB (after a `mysqldump`)?
  Assumption: the developer asks at the slice 1 verify step and skips the check without an OK.

## Follow-ups

- None found in the code this plan touches. Edge cases for later parts are recorded in briefs 013 to 015 (same-second
  `deleted_at` stamps, restoring an expense into a deleted category, `tech_name` uniqueness including deleted rows,
  accent-insensitive collation, the meaning of the reorder list).

## Deviations

None.

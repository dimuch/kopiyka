# Plan: Delete a category, with a warning and Undo — API

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/delete-category
Base: origin/main @ 731c9e3

## Approach

The API gets three category routes, kept in `categories/routes.ts`: GET one category with its all-time expense count
and EUR total (the numbers for 018's confirm screen), DELETE, and restore. DELETE runs one transaction. It stamps the
category and all of its live expenses with the same `deleted_at`. Restore reads the category's stamp under a row lock
and brings back only the expenses carrying that stamp. Expenses deleted earlier on their own have an older stamp, so
they stay deleted. No migration is needed: 012 already added `categories.deleted_at`. Restoring a single expense now
needs a live category. Conventions §3 gets one line.

Alternative considered: **a deletion marker** (e.g. a new `expenses.deleted_with_category` column) instead of a shared
stamp. It is exact, but it costs a migration and a schema change. The only case it fixes is an expense deleted on its
own within the same second as its category's delete. That needs two devices acting together, and the result is
harmless: the expense comes back on Undo and can be deleted again. The brief records this decision.

## Contracts

- **DB:** none.
  - Columns used: `categories.deleted_at` (migration 003) and `expenses.deleted_at` (001).
  - `category_budgets` rows of a deleted category are not touched. Nothing reads them (`rg category_budgets apps` finds
    only migration 001 and the test helper's table list). Their FK cascades only on a hard delete. Slice 2's test shows
    a budget row surviving a delete.
- **API:** all three routes use `preHandler: [app.requireAuth, app.requireLedger]` and scope by `c.ledger_id`.
  - Params: `CategoryParams = z.object({ categoryId: z.coerce.number().int().positive() })`.
  - Shared errors: a non-numeric id gives `400 { error: 'invalid_request' }`; a missing session gives
    `401 { error: 'unauthorized' }`; a non-member ledger gives `404 { error: 'not_found' }`.
  - `GET /api/ledgers/:id/categories/:categoryId` → `200 CategoryWithTotalsDto`:
    `{ categoryId: number, techName: string, displayName: string, sortOrder: number, expenseCount: number, totalEur: string }`.
    - `expenseCount` counts the category's live expenses in every month.
    - `totalEur` is their `amount_eur` sum as a decimal string, `'0.00'` when there are none. Checked on the test DB
      (MySQL 26.7): `COUNT` comes back as a number, and `COALESCE(SUM(DECIMAL(12,2)), 0)` as `'0.00'` or `'1234.50'`.
    - Errors: an unknown, foreign or deleted category → `404 not_found`.
  - `DELETE /api/ledgers/:id/categories/:categoryId` → `204`. One transaction:
    1. `UPDATE categories SET deleted_at = :at … AND deleted_at IS NULL`. If no row changes, stop with 404.
    2. Set the category's live expenses to `deleted_at = :at, updated_at = updated_at`, with a `JOIN categories` on
       `ledger_id`.
    - Errors: an unknown, foreign or already-deleted category → `404 not_found`.
  - `POST /api/ledgers/:id/categories/:categoryId/restore` → `204`. One transaction:
    1. `SELECT deleted_at … AND deleted_at IS NOT NULL FOR UPDATE`. If there is no row, stop with 404.
    2. Restore the expenses `WHERE category_id = ? AND deleted_at = <that stamp>`, joined on `ledger_id`, with
       `updated_at = updated_at`.
    3. Set the category's `deleted_at = NULL`.
    - Errors: an unknown, foreign or live category → `404 not_found`.
  - Changed: `POST /api/ledgers/:id/expenses/:expenseId/restore` → `404 not_found` when the expense's category is
    deleted. Only the restore direction of `setDeleted` adds `AND c.deleted_at IS NULL`.
  - Unchanged: GET one, PUT and DELETE of a single expense.
  - New helper in `apps/api/src/db.ts`:
    `withTransaction<T>(db: Db, fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T>`. It begins, runs `fn`,
    commits, rolls back if `fn` throws, and always releases. Its JSDoc says `fn` must use only `conn`, as
    `auth/throttle.ts` warns: a second pool connection while holding row locks can starve the pool. Callers: category
    DELETE and restore.
- **Consumers:** none in this PR. Brief 017 mirrors `CategoryWithTotalsDto` as `CategoryWithTotals` in
  `apps/mobile/src/api/types.ts` and adds the client calls; brief 018 shows the numbers and calls delete and restore.
- **New dependencies:** none.

## Slices

- [ ] 1. Show a category's expense count and total across all months
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`
  - Change:
    - Add `CategoryParams`, a shared `guards` constant, and `toDto(r)`, which the list now uses too.
    - Add `CategoryWithTotalsDto` and the GET-one route, with this SQL:
      `LEFT JOIN expenses e ON e.category_id = c.category_id AND e.deleted_at IS NULL`,
      `WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL GROUP BY c.category_id`.
      No row → 404.
  - Tests:
    - Rename the top `describe` to `categories API (MySQL)`. The existing cases stay.
    - Add a helper `addSpend(techName, expenseDate, amountEur, deletedAt = null): Promise<number>`. It inserts by SQL
      with `created_by = owner.userId` and `created_at = updated_at = clock` (fixed values, so an `ON UPDATE` firing on
      delete or restore shows up in slice 3's `toEqual`), and returns the id. It is a separate helper rather than an
      extension of `addExpense`, whose two existing callers stay as they are.
    - "gives a category's expense count and EUR total across all months":
      - Groceries gets `2026-09-15 '12.50'`, `2026-10-01 '1222.00'` and a deleted `'5.00'`. Car gets `'99.00'`.
      - Expect `200 { categoryId, techName: 'groceries', displayName: 'groceries', sortOrder: 20, expenseCount: 2, totalEur: '1234.50' }`.
        That is 12.50 + 1222.00; the deleted 5.00 and car's 99.00 are left out.
      - Gym gives `{ expenseCount: 0, totalEur: '0.00' }`.
    - "answers 404 for an unknown, foreign or deleted category": `999999`; a stranger's `rent` id through my ledger;
      groceries after `UPDATE … deleted_at`.
    - Guards `describe.each` for GET one: 401 without a session, 404 on a stranger's ledger, 400 `invalid_request` for
      id `abc`. DELETE and restore join it in slices 2 and 3.
    - About 75 lines.
- [ ] 2. Delete a category together with its expenses
  - Files: `apps/api/src/db.ts`, `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`
  - Change:
    - Add `withTransaction`.
    - Add the DELETE route as in Contracts. `categoryRoutes` now also takes `now` from `AppDeps`.
    - Add a comment saying why the stamp is shared: restore matches it, so it brings back only these expenses.
  - Tests:
    - "deletes a category and its live expenses in one stamp":
      - Groceries has two expenses (Sep, Oct) and a budget row
        (`INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-10-01', 100)`).
      - DELETE → 204.
      - The list has 14 categories, none of them groceries. GET one → 404.
      - `SELECT deleted_at FROM expenses WHERE category_id = ?` → both equal `clock`.
      - The 2026-10 month list is exactly `[the car expense]`. The budget row is still there.
      - A second DELETE → 404.
    - "answers 404 for an unknown or foreign category" (DELETE).
    - Add DELETE to the guards `describe.each`.
    - About 95 lines.
- [ ] 3. Restore a deleted category with exactly the expenses deleted with it
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/src/expenses/routes.ts`,
    `apps/api/test/categories.int.test.ts`, `apps/api/test/expenses.int.test.ts`
  - Change:
    - Add the restore route as in Contracts.
    - In `setDeleted`, the restore direction adds `AND c.deleted_at IS NULL`, a fixed fragment chosen in code. Its
      JSDoc says a restore needs a live category.
  - Tests in `categories.int.test.ts`. The app's clock becomes `let now = clock`, reset in `beforeEach`.
    - "restores the category and its expenses unchanged":
      - GET both expenses through `/expenses/:id`.
      - Delete the category, then restore it → 204.
      - The two expense DTOs `toEqual` the ones from before, so `updated_at` was kept.
      - GET one shows count 2 and total `'1234.50'`. The list has 15 categories.
    - "keeps an expense deleted earlier on its own deleted":
      - Groceries has expenses A and B. `DELETE /expenses/A` at `clock`.
      - Set `now = 2026-10-06T10:05:00Z`, then delete and restore the category.
      - B is back. `GET /expenses/A` → 404. GET one shows count 1.
      - `POST /expenses/A/restore` → 200.
    - "answers 404 for restoring a live, unknown or foreign category".
    - Add restore to the guards `describe.each`.
  - Tests in `expenses.int.test.ts`, "DELETE and restore", new case "will not restore an expense into a deleted
    category":
    - Delete the expense and set groceries' `deleted_at` by SQL. Restore → `[404, { error: 'not_found' }]`, and the
      month list is still empty.
    - Clear `deleted_at`. Restore → 200.
  - About 95 lines.
- [ ] 4. Note category soft delete in the conventions
  - Files: `.claude/skills/kopiyka-conventions/SKILL.md` (§3)
  - Change: the line becomes "Soft delete for expenses and categories (`deleted_at`) so Undo works; reads filter
    `deleted_at IS NULL` (expense lists also skip deleted categories; a single expense's GET, PUT and DELETE don't).
    Deleting a category stamps its live expenses
    with the same `deleted_at`, which its restore matches." About 5 lines.
  - Verify: `yarn format:check` (Prettier covers Markdown).

Total: about 270 changed lines.

## AC → evidence

| AC                                                                                                                              | Evidence                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delete soft-deletes the category and its live expenses in one transaction; restore brings back both, only those deleted with it | `withTransaction` in DELETE and restore (slices 2–3 diff); `categories.int.test.ts` "deletes a category and its live expenses in one stamp", "restores the category and its expenses unchanged", "keeps an expense deleted earlier on its own deleted" |
| …tests: happy, 401, non-member 404, unknown/already-deleted 404, earlier-deleted expense stays deleted                          | The cases above, the guards `describe.each` (GET one, DELETE, restore) and the "answers 404 for …" cases (slices 1–3)                                                                                                                                  |
| Confirm numbers (count + EUR total, all months) come from the API, tested                                                       | `categories.int.test.ts` "gives a category's expense count and EUR total across all months" (slice 1)                                                                                                                                                  |
| Single-expense restore into a deleted category → 404, restorable after the category is back                                     | `expenses.int.test.ts` "will not restore an expense into a deleted category" (slice 3); "keeps an expense deleted earlier…" ends with A's own restore → 200                                                                                            |
| Conventions §3 covers categories                                                                                                | Slice 4 diff                                                                                                                                                                                                                                           |
| Gates green                                                                                                                     | `yarn format:check && yarn lint && yarn typecheck && yarn test` before every commit                                                                                                                                                                    |

## Not doing (YAGNI)

- **A migration or marker column for "deleted with the category".** The shared stamp is enough (see Risks).
- **Category checks in GET one, PUT and DELETE of a single expense.** A live expense in a deleted category exists only
  through the race in Risks. 012's PUT tests ("will not keep…", and the "way out" move) stay valid.
- **A response body for category DELETE or restore** (both 204). Nothing reads one. Expense restore returns its DTO,
  but nothing reads that either.
- **Counting deleted expenses in the DELETE response.** 018's Undo text uses the count the user confirmed.
- **Handling a name clash on restore.** Categories can't be created until brief 014, which owns that rule.
- **Anything in the app** (briefs 017 and 018). Also out: moving expenses to another category, purging, budgets,
  rename, create and reorder.
- **Refactoring `admin.ts` and `auth/throttle.ts` onto `withTransaction`.** See Follow-ups.

## Risks

- **Same-second stamps.** `deleted_at` is `DATETIME` and stores whole seconds; MySQL rounds the fractional part. An
  expense deleted on its own within the same second as its category's delete gets the same stamp, so it comes back
  with the category's restore. Accepted in the brief. Slice 3's test keeps the two deletes 5 minutes apart, which is
  the normal case.
- **A write in flight.**
  - A POST or PUT passes `checkCategory`, then waits on an uncached NBU rate fetch. If the category is deleted during
    that wait, the expense is written live into a deleted category.
  - Such an expense is hidden from every list and total (012's filters) and reappears if the category is restored. GET
    one still returns it.
  - Accepted for a two-user ledger. Locking the category in POST and PUT would be a bigger change than the brief asks
    for.
- **The fixed test clock.** The integration tests use `now: () => clock`. With one fixed instant, an expense deleted
  on its own and its category would share a stamp. Slice 3 makes the clock movable in `categories.int.test.ts` only;
  the other suites are unchanged.
- **Deadlock with a single-expense delete or restore.**
  - Category DELETE and restore lock the category, then its expenses. A single-expense DELETE or restore
    (`UPDATE expenses e JOIN categories c`) can take them the other way round.
  - If two devices hit the same category at the same instant, InnoDB rolls one back as a deadlock, and that request
    answers 500. The data stays consistent, and a retry works.
  - Accepted; documented only. Ordering the locks in `setDeleted` would be a bigger change than the brief asks for.

## Open questions

None blocking. These were decided at Gate A on 2026-10-09 and are recorded in the brief: shared stamp; single-expense
restore into a deleted category → 404; GET one, PUT and DELETE of a single expense unchanged; 204 bodies.

## Follow-ups

- `admin.ts` `createUserWithLedger` could use `withTransaction`. `auth/throttle.ts` can't directly, because it rolls
  back early on `blocked`.
- Brief 014 decides what restore does when a live category with the same name was created after the delete (already
  noted there).

## Deviations

<filled by the developer during build>

## Revision 1

The user split the feature at Gate A (2026-10-09) into three sequential briefs: 013 (API, this plan), 017 (client
calls and a shared Undo bar on Home) and 018 (the ⋯ menu, the confirm screen, delete → Home with Undo). This plan
keeps the API slices 1–4 unchanged. The app slices 5–8, their contracts, the menu, navigation and Undo-count risks,
and the split question are gone; the app's assumptions moved to briefs 017 and 018. The brief gained an AC for the
single-expense restore 404 and one for the conventions line, both already planned in slices 3 and 4.

## Revision 2

Skeptic edits:

- `addSpend` stores fixed `created_at = updated_at = clock`, so a missing `updated_at = updated_at` fails slice 3's
  `toEqual`.
- The §3 line now says expense lists skip deleted categories, but a single expense's GET, PUT and DELETE don't.

Suggestions taken:

- `withTransaction`'s JSDoc says `fn` must use only `conn`.
- Slice 2 asserts that the October list is exactly the car expense.
- A deadlock risk is documented.

Suggestions not taken:

- Extending `addExpense`: a separate helper leaves its two callers untouched.
- Matching via `e.deleted_at = c.deleted_at` in the join: the `SELECT … FOR UPDATE` is still needed for the 404 and the
  lock, so reusing its stamp is just as simple.

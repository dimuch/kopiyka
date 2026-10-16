# Plan: Remove a category from one month, in the API (per-month categories, part 2 of 4)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/remove-category-from-month
Base: origin/main @ a7015b8

## Approach

Two new endpoints, plus a `?month=` filter on `GET one`, all in `categories/`.

- `categories/monthLists.ts` gets `removeFromMonth` and `restoreToMonth`. Each runs one transaction. Each starts by
  locking the ledger row, so only one list change runs per ledger at a time.
- A private `pinMonth` stores the list a month inherits as that month's own rows. It copies removed rows too, with
  their stamp, so an earlier removal's Undo still reaches a month pinned later.
- **Remove from M:**
  1. Pin M.
  2. Pin M+1 too, if M+1 is the month of Kyiv tomorrow. An expense can already be dated then (`isAfterRateHorizon`),
     so that month counts as started.
  3. Stamp `(category, M)` and M's live expenses in the category with one `deleted_at`. When M+1 wasn't pinned, also
     stamp the category's live rows in the later months that have their own list, so every later month that hasn't
     started loses it.
- **Restore** clears exactly the rows (month M and later) and M's expenses that carry that stamp.
- A new pure `monthEnded(month, now)` in `dates.ts` makes the routes answer `409 month_ended` before touching the DB.
  The lock brief reuses it.
- Expense reads and the Notion loaders don't change. The stamped expenses drop out because those reads filter on
  `e.deleted_at` (028's invariant). Slice 4 proves this for Notion.

Alternative considered: no pinning, storing only "removals" or a range of months. This was rejected in 028 because it
can't keep a started month's list. Within the 028 model, the alternative is to stamp only M and let later months that
have their own list keep the category. That is simpler by one operator (`=` instead of `>=`), but a month removed
earlier (December) would then show the category again after it's removed from October. That breaks the carry-over AC.

## Decisions this plan makes (the brief leaves them to the planner)

- **Ended month: `409 { error: 'month_ended' }`.** The request is well-formed and was valid until midnight in Kyiv.
  It conflicts with the month's state, like the existing `409 sync_in_progress`. A 400 would sit next to Zod's
  `invalid_request`, but the lock brief's restore and delete of an expense have no body to be invalid. Precedence:
  401, then non-member 404, then 400 (malformed params), then **409**, then 404 for the category. The 409 comes before
  the category lookup, so an ended month changes nothing and reads nothing. That leaks nothing, because the ledger is
  already checked. "Ended" means `month < kyivToday(now).slice(0, 7)`, from the 1st at 00:00 Kyiv time, with no grace
  period (028 Decision 3).
- **Check-then-write race (028 plan, Follow-ups): accepted here, handed to the lock brief.** The race is real only
  when two members of one ledger act on the same category and month in the gap between `checkCategory` and the
  INSERT/UPDATE (a few ms, or seconds during an NBU fetch).
  - The result would be one live expense in a month whose list lacks its category. It still shows in that month's
    list and total, and in Notion, and the user can delete it. Nothing is lost.
  - 013's delete has had the same race since it shipped.
  - A real fix means a transaction around a network fetch, or a re-check inside the write. The lock brief rewrites the
    same POST/PUT checks for its own check-then-write race at midnight ("not ended" checked at 23:59:59, written at
    00:00:00), so one re-check there fixes both.
  - Remove and restore themselves are serialised by the ledger-row lock, so two removals can't collide.

## Contracts

- DB: none. It uses `category_months` (migration 007) as is.
- `apps/api/src/dates.ts`:

  ```ts
  /** True once a 'YYYY-MM' month has ended in Kyiv: from the 1st of the next month, 00:00 Kyiv time. */
  export function monthEnded(month: string, now: Date): boolean; // month < kyivToday(now).slice(0, 7)
  ```

- `apps/api/src/categories/monthLists.ts`. `db` is `Db` from `../db.js`, and each function runs one `withTransaction`
  that starts with `SELECT ledger_id FROM ledgers WHERE ledger_id = ? FOR UPDATE`:

  ```ts
  /**
   * Removes a category from a 'YYYY-MM' month that hasn't ended, with that month's live expenses in it, under one
   * stamp (`now`). False, writing nothing, when the category isn't in the month's list (unknown, foreign, deleted
   * or already removed).
   */
  export async function removeFromMonth(
    db: Db,
    ledgerId: number,
    categoryId: number,
    month: string,
    now: Date,
  ): Promise<boolean>;

  /** Undoes the removal of a category from a month: the rows and that month's expenses carrying its stamp. False when it isn't removed there. */
  export async function restoreToMonth(db: Db, ledgerId: number, categoryId: number, month: string): Promise<boolean>;
  ```

  - **Remove.** All SQL is fixed fragments. `first = ${month}-01`, `next = nextMonthStart(month)`.
    1. Check:
       `SELECT 1 FROM categories c WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}`,
       with params `[categoryId, ledgerId, first]`. No row means `return false`.
    2. `pinMonth(conn, ledgerId, first)`. Then, when `next.slice(0, 7) <= addDays(kyivToday(now), 1).slice(0, 7)`
       (`keepNext`), also `pinMonth(conn, ledgerId, next)`.
    3. Stamp the rows:
       `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id SET m.deleted_at = ? WHERE m.category_id = ? AND c.ledger_id = ? AND m.deleted_at IS NULL AND m.list_month ${keepNext ? '= ?' : '>= ?'}`,
       with params `[now, categoryId, ledgerId, first]`.
    4. Stamp the expenses:
       `UPDATE expenses e JOIN categories c ON c.category_id = e.category_id SET e.deleted_at = ?, e.updated_at = e.updated_at -- not an edit WHERE e.category_id = ? AND c.ledger_id = ? AND e.deleted_at IS NULL AND e.expense_date >= ? AND e.expense_date < ?`.
  - **`pinMonth(conn, ledgerId, first)`** (private). The month's own rows, if it has any, are the latest stored month,
    so then nothing is copied.

    ```sql
    INSERT INTO category_months (category_id, list_month, deleted_at)
    SELECT m.category_id, ?, m.deleted_at
      FROM category_months m JOIN categories c ON c.category_id = m.category_id
     WHERE c.ledger_id = ?
       AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                             JOIN categories lc ON lc.category_id = lm.category_id
                            WHERE lc.ledger_id = ? AND lm.list_month <= ?)
       AND m.list_month < ?
    ```

    Params: `[first, ledgerId, ledgerId, first, first]`.

  - **Restore.**
    1. `SELECT m.deleted_at FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE m.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL AND m.list_month = ? AND m.deleted_at IS NOT NULL`.
       No row means `return false`. A month with no row of its own isn't "removed there", even if it inherits a
       removal.
    2. Clear the expenses: `UPDATE expenses e JOIN categories c … SET e.deleted_at = NULL, e.updated_at = e.updated_at WHERE e.category_id = ? AND c.ledger_id = ? AND e.deleted_at = ? AND e.expense_date >= ? AND e.expense_date < ?`.
    3. Clear the rows: `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id SET m.deleted_at = NULL WHERE m.category_id = ? AND c.ledger_id = ? AND m.list_month >= ? AND m.deleted_at = ?`.

    A copied stamp counts as removed there. Example: eating_out is removed from October while November has no list
    of its own, and later something else is removed from November, which pins November with eating_out's October
    stamp. Restoring eating_out to November then answers 204 and brings it back from November on, but October keeps
    it out. That is the same result as Undo for November, and it changes no expenses, because November has none with
    that stamp.

- API (`apps/api/src/categories/routes.ts`), guards `[requireAuth, requireLedger]`.
  - New Zod schemas:
    - `MonthParams = CategoryParams.extend({ month: z.string().regex(MONTH_RE, 'expected YYYY-MM') })`;
    - `OneQuery = z.object({ month: …regex(MONTH_RE).optional() })`, with the comment "optional until part 4 (brief
      031); without it, all months, for 018's screen".
  - `DELETE /api/ledgers/:id/categories/:categoryId/months/:month` returns `204`.
    - Errors: `400 invalid_request` (id, categoryId or month malformed), `401 unauthorized`, `404 not_found`
      (non-member; category not in that month's list: unknown, foreign, deleted, already removed, or removed by an
      earlier month), `409 month_ended`.
  - `POST /api/ledgers/:id/categories/:categoryId/months/:month/restore` returns `204`.
    - Errors: the same codes. Its 404 means not removed in that month: in the list, inherited, unknown, foreign or
      deleted.
  - `GET /api/ledgers/:id/categories/:categoryId?month=YYYY-MM` returns `200 CategoryWithTotalsDto`, with
    `expenseCount`/`totalEur` counting only live expenses dated in that month.
    - It answers `404 not_found` when the category isn't in that month's list.
    - With a month, the SQL adds `AND e.expense_date >= ? AND e.expense_date < ?` to the LEFT JOIN, and
      `AND ${inMonthList('?')}` to the WHERE. Params: `[first, next, categoryId, ledgerId, first]`.
    - Without `month` the query and the answer are unchanged.
    - The DTO's JSDoc changes from "across all months" to "across all months, or one month with `?month=`".
- App: none. `CategoryWithTotalsDto`'s shape is unchanged, and the app maps `month_ended` in a later part.
- New dependencies: none.

## Slices

- [x] 1. Count a category's expenses in one month with ?month=
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`.
  - Change: `OneQuery` and the month-scoped SQL above. The DTO comment is updated.
  - Tests (`describe('one category')`, clock 2026-10-06):
    - Setup: groceries 2026-09-15 12.50, 2026-10-01 1222.00 and 2026-10-02 5.00 (deleted), plus car 2026-10-01 99.00.
    - `?month=2026-10` gives `{ expenseCount: 1, totalEur: '1222.00' }`, and `?month=2026-09` gives `1, '12.50'`.
      gym `?month=2026-10` gives `0, '0.00'`.
    - After `storeMonthList(…, '2026-11', ['groceries'])`, `?month=2026-11` and `?month=2026-12` give
      `404 { error: 'not_found' }`.
    - `?month=2026-13` gives 400 `invalid_request`.
    - The existing all-months test stays unchanged.
  - ≈ 40 lines.
- [ ] 2. Tell when a month has ended in Kyiv time
  - Files: `apps/api/src/dates.ts`, `apps/api/test/dates.test.ts`.
  - Tests (table, with the arithmetic in comments; Kyiv is UTC+3 until 25 Oct 2026, UTC+2 after):
    - `('2026-09', 2026-09-30T20:59:59Z)` gives false (23:59:59 on 30 Sep in Kyiv);
    - `('2026-09', 2026-09-30T21:00:00Z)` gives true (00:00 on 1 Oct);
    - `('2026-10', 2026-10-31T21:59:59Z)` gives false;
    - `('2026-10', 2026-10-31T22:00:00Z)` gives true;
    - `('2026-11', 2026-10-06T10:00:00Z)` gives false (a later month);
    - `('2025-12', 2026-01-01T10:00:00Z)` gives true (across a year).
  - ≈ 20 lines.
- [ ] 3. Remove a category from one month, with its expenses there
  - Files: `apps/api/src/categories/monthLists.ts` (`removeFromMonth`, `pinMonth`), `apps/api/src/categories/routes.ts`
    (`MonthParams`, the DELETE route: parse, then `monthEnded` and 409, then `removeFromMonth` and 204/404),
    `apps/api/test/categories.int.test.ts`.
  - Tests, in a new `describe('remove from a month')`, with helpers
    `removeFrom(id, headers = auth, ledgerId = owner.ledgerId, month = '2026-10')` and `listOf` (exists):
    - **Only that month (AC1), on 31 Oct.**
      - Setup: `now = 2026-10-31T10:00:00Z` and re-login (`auth = await authHeader(app, owner, now)`; the clock moves
        forward, so the old session has expired). eating_out has expenses 2026-09-15 12.50, 2026-10-01 20.00,
        2026-10-02 30.00 and 2026-11-01 7.00, and car has 2026-10-03 40.00.
      - Remove eating_out from 2026-10 gives 204.
      - Lists: `listOf` 2026-09 and 2026-11 have it (15), 2026-10 doesn't (14). `listOf('2026-12')` has it too (15).
      - Expenses: `GET /expenses?month=2026-10` gives only the car expense; the month total, summed by the test from
        the list's `amountEur` (as the app does), is 40.00. 2026-09 gives the Sep one, and 2026-11 gives the Nov 1 one.
      - Totals: `GET one ?month=2026-09` gives `1, '12.50'` and `?month=2026-11` gives `1, '7.00'`.
      - DB: the two eating_out expenses dated 2026-10-01 and 2026-10-02, and eating_out's `category_months` row for
        2026-10-01, have `deleted_at` equal to `now`. The 2026-09-15 and 2026-11-01 expenses and eating_out's
        2026-11-01 row (pinned) keep `deleted_at` NULL.
    - **Carry-over (AC2), on 6 Oct.** Remove eating_out from 2026-10. `listOf` 2026-11 and 2027-03 don't have it, and
      2026-09 does.
    - **A later month with its own list loses it too.** On 6 Oct, remove gym from 2026-12, then eating_out from
      2026-10. 2026-12 has neither, 2026-11 has gym but not eating_out, and 2026-10 has gym.
    - **Ended month (AC4).**
      - `now = 2026-09-30T21:00:00Z` (no re-login needed, because the clock moves back inside the session). Remove
        from 2026-09 gives `409 { error: 'month_ended' }`, and nothing changes: `listOf('2026-09')` has 15, the Sep
        expense is live, and the `category_months` row count is unchanged at 15.
      - At `2026-09-30T20:59:59Z`, the same request gives 204.
    - **404 (AC5).** All of these give `{ error: 'not_found' }`, and the row count is unchanged:
      - unknown 999999;
      - a stranger's rent;
      - groceries after 013's DELETE;
      - eating_out removed twice (the second call);
      - eating_out from 2026-11 after its removal from 2026-10.
    - **400.** Months `2026-13`, `2026-1` and `abc` give `invalid_request`.
    - The `describe.each` guards (401, non-member 404, non-numeric id 400) gain `['remove from month', removeFrom]`.
  - ≈ 150 lines.
- [ ] 4. Restore a category to one month (Undo), and prove the Notion sync follows both
  - Files: `apps/api/src/categories/monthLists.ts` (`restoreToMonth`), `apps/api/src/categories/routes.ts` (the POST
    route, the same shape as DELETE), `apps/api/test/categories.int.test.ts`.
  - Tests, in `describe('restore to a month')`, with helper `restoreTo` (same signature):
    - **Exactly that removal (AC3).**
      - Setup: eating_out has a = 2026-10-01 and b = 2026-10-02. c = 2026-10-03 is deleted on its own via
        `DELETE /expenses/c`.
      - Record a's and b's GET bodies. At `now = 10:05`, remove from 2026-10, then restore gives 204.
      - a and b are equal to before (updated_at included). c is still 404. `listOf` 2026-10 and 2026-11 have
        eating_out. `GET one ?month=2026-10` gives `expenseCount: 2`.
      - Restore again gives 404.
    - **A later own list comes back too.** Continue the "later month" setup: restore eating_out to 2026-10. 2026-12
      has eating_out again and still lacks gym.
    - **Ended month (AC4).**
      - At `2026-09-30T20:59:59Z`, remove eating_out (with a 2026-09-15 expense) from 2026-09.
      - At `2026-09-30T21:00:00Z`, restore gives `409 month_ended`. 2026-09 still lacks it, and the expense is still
        deleted.
    - **404 (AC5).** All of these give `not_found`:
      - rent in 2026-10 (not removed);
      - eating_out in 2026-11 after its removal from 2026-10 (inherited, not removed there);
      - unknown 999999;
      - a stranger's rent;
      - groceries removed from 2026-10, then deleted through 013.
    - **400.** Malformed months.
    - The guards `describe.each` gains `['restore to month', restoreTo]`.
    - **Notion (AC7)**, `describe('Notion after a removal')`. The test DB is `kopiyka_test`, and these call only
      `loadGroceries`/`planGroceries`/`loadUncounted` from `src/notion/*` on the test's own ledger, so no Notion API
      is reachable. Scope is `{ ledgerId: owner.ledgerId, year: 2026 }`.
      - Setup: groceries g9 = 2026-09-15 and g10 = 2026-10-01, each with a matching `notion_grocery_rows` row (same
        name, amount and date). car c9 = 2026-09-20 and c10 = 2026-10-02.
      - Before: `planGroceries` gives `[]`, and `loadUncounted` ids are `[c9, c10]`.
      - After removing groceries and car from 2026-10: `planGroceries` gives `[['trash', g10]]` (as kind and id), and
        `loadUncounted` ids are `[c9]`.
      - After restoring both: `loadGroceries` gives `wanted` true for g9 and g10, `planGroceries` gives `[]`, and
        `loadUncounted` ids are `[c9, c10]`.
  - ≈ 150 lines.

Total ≈ 360 changed lines, tests included. `routes.ts` grows from 137 to about 175 lines, because the transactions
live in `monthLists.ts`. Part 4 removes 013's delete and restore (about 45 lines).

## AC → evidence

| AC                                                                                                 | Evidence                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove: only that month's list and expenses change; before/after keep both; totals                 | Slice 3 › "only that month, on 31 Oct" (lists, expenses per month, `GET one ?month=` totals, stamps)                                                                                            |
| Carry-over, incl. 31 Oct keeps November                                                            | Slice 3 › "carry-over, on 6 Oct", "only that month, on 31 Oct" (November keeps it), "a later month with its own list loses it too"                                                              |
| Restore: category and exactly that removal's expenses; earlier deleted stays deleted               | Slice 4 › "exactly that removal" (equal DTOs, c still 404), "a later own list comes back too"                                                                                                   |
| Ended month: remove and restore refused, nothing changes                                           | Slice 2 `dates.test.ts` (boundaries). Slice 3 › ended month (409 at 21:00Z, 204 at 20:59:59Z, rows unchanged). Slice 4 › ended month (409, still removed)                                       |
| Errors: 401, 404 other ledger, 404 unknown/foreign/deleted/removed or not removed, 400             | Slices 3 and 4 › 404 and 400 tests, plus the `describe.each` guards for both routes                                                                                                             |
| `GET one ?month=` counts that month only; 404 when not in it                                       | Slice 1 › one category                                                                                                                                                                          |
| Notion: groceries unwanted only that month (wanted after restore); uncounted drops only that month | Slice 4 › Notion after a removal (integration tests on `kopiyka_test` only, no manual Notion check, never ledger 1)                                                                             |
| Gates green                                                                                        | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit, with `DATABASE_URL_TEST` exported from the main checkout's `apps/api/.env`; check that the MySQL suites ran |

## Not doing (YAGNI)

- Any app change: no `month_ended` copy, no client calls. Those come in parts 3 and 4, and the lock brief.
- Removing 013's delete and restore and 018's client calls (part 4).
- Refusing expense writes in ended months (the lock brief), and locking expense saves against a concurrent removal
  (see Decisions).
- A response body for remove (for example counts). The confirm screen gets them from `GET one ?month=` first.
- Making `month` required on `GET one` (part 4).
- A conventions §3 change. Its soft-delete sentence is still true for 013. The per-month invariant is proposed under
  Follow-ups.

## Risks

- **MySQL might refuse `pinMonth`'s `INSERT INTO category_months … SELECT … FROM category_months` with a subquery on
  the same table.** The docs allow the target in an INSERT … SELECT, because MySQL buffers it in a temporary table.
  Slice 3's first test settles it. Fallback: read the source month with
  `SELECT MAX(list_month) …` first, then `INSERT … SELECT … WHERE m.list_month = ?`.
- **The ledger-row `FOR UPDATE` could wait on another lock of `ledgers`.** No code locks `ledgers` today (checked
  with rg for `FOR UPDATE` in `apps/api/src`). FK checks only take shared locks on `categories`. The integration suite
  shows any wait as a timeout.
- **The stamps are `DATETIME`, rounded to seconds.** An expense deleted on its own in the same second as a removal
  would come back on Undo. 013 has the same limit. The tests use whole-second clocks and move to `10:05` before
  removing, as 013's test does.
- **Login runs on the injected clock.** Tests that move it forward must log in again. Moving it back keeps the
  session, and a login there would be refused as a reused TOTP step. The slices above follow this.

## Open questions

- **No.** The ended-month code is `409 month_ended`, checked after 400 and before the category 404. Assumption
  meanwhile: as above. The lock brief reuses it.
- **No.** The race is accepted here (see Decisions), and the lock brief re-checks the list and the month inside the
  expense write. Assumption meanwhile: accepted. If you want it closed now, it adds about 40 lines to this brief: a
  re-check inside the INSERT/UPDATE, plus a Prove-It test whose `fetchRate` stub removes the category mid-save.
- **No.** AC1's "the month after keeps both" is read as the month of Kyiv tomorrow, the only later month that can
  hold expenses. Otherwise it would contradict AC2. So AC1 is tested on 31 Oct. Assumption meanwhile: this reading.
- **No.** Removing from a month that hasn't started (the app's month switcher can go forward) is allowed. It also
  stamps the category in later months that have their own list, so they don't show it again. Assumption meanwhile:
  allowed.
- **Decided at Gate A (user, 2026-10-16): yes.** On a month's last day, months after M+1 keep the category too. They carry over M+1's list, or keep their
  own stored list, the same reading 028's plan used for a started month. The
  alternative (pin M+2 too, and stamp `list_month = M OR list_month >= M+2`) was declined.

## Follow-ups

- Lock brief: move `checkCategory`'s list check and the new "month not ended" check into the expense INSERT/UPDATE
  (`INSERT … SELECT … WHERE …`), to close both check-then-write races. Reuse `monthEnded` and `409 month_ended`.
- Conventions §3 (proposal for part 4): "A live expense's category is in its month's list; writes keep it so.
  Removing a category from a month stamps that month's live expenses with the row's `deleted_at`, which its restore
  matches."
- `apps/api/test/expenses.int.test.ts` asserts 404 twice in a row (from 028). It's harmless, and still open.
- `MONTH_RE` accepts `9999-12`, and then `nextMonthStart` gives `+010000-01-01`. This already affects
  `GET /expenses?month=9999-12`, and the new routes and `GET one ?month=` share it. Only a crafted request reaches it,
  and it most likely ends in a 500 rather than a 400. Fix it once for every `MONTH_RE` use, for example with a year
  cap in `MONTH_RE`.

## Deviations

<filled by the developer during build>

## Revision 1

- Skeptic #10: added an Open question on a month's last day. Months after M+1 keep the category, as in 028's
  reading. Slice 3's 31 Oct test now also checks that `listOf('2026-12')` has it.
- Skeptic #8: slice 3's 31 Oct test now sums the October total from the list's `amountEur`, as the app does.
- Suggestions taken:
  - (a) Contracts now document that restoring a copied stamp answers 204, with the example. No check was added.
  - (b) Both `UPDATE category_months` statements now join `categories` on `ledger_id`.
  - (d) The `9999-12` month is a Follow-up, because it already affects every `MONTH_RE` use.
  - (e) The 31 Oct DB assertion now names each expense and row it checks.
- Not taken: (c), a separate Notion slice. It would be a tests-only final slice, and slice 4 stays at about 150
  lines.

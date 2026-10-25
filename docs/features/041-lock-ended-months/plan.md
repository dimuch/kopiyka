# Plan: Lock expenses in ended months

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/lock-ended-months
Base: origin/main (cc420d6, includes #53 / brief 038).

## Approach

API: the four expense write routes in `apps/api/src/expenses/routes.ts` call the existing
`monthEnded(month, now)` from `dates.ts` and reply `409 month_ended`. For PUT, DELETE and restore this happens
after the expense is found in the caller's ledger (404 first) and before any category check, rate lookup or write.
DELETE and restore get their stored date from `loadExpense`, which gains a `deleted` flag so restore can find a
soft-deleted row. App: the expense form works out one rule from the `today` it already reads once: an expense dated
before the 1st of today's month is read-only. Its date picker can't go below that 1st. The server's `month_ended`
on save, delete and Undo is turned into the brief's text. The date rules go in a small pure module,
`data/expenseLock.ts`, and the texts go next to 038's `monthEndedText` in `data/monthEnded.ts`.
Alternative considered: put the month rule in the write SQL (`AND e.expense_date >= ?`) so check and write are one
statement. Rejected: telling 404 from 409 then needs a second read, and it still doesn't close the only real gap,
which is the clock passing midnight (see Risks).

### Check order (confirms the brief's proposal)

`400 invalid_request` (Zod) → `404 not_found` (PUT/DELETE/restore: no such expense in this ledger) →
**`409 month_ended`** → `400 unknown_category` / `400 category_not_in_month` → `400 date_in_future` →
`503 rate_unavailable`. 401 and the ledger 404 come earlier, from the guards. Why `month_ended` goes before the
category check:

- Nothing fixes an ended month. `category_not_in_month` suggests choosing another category, which can't help.
- An ended month with no list (August in the tests) now says "ended", so the app no longer needs its "had no budget,
  so it can't take expenses" wording for ended months (slice 4 removes it).
- A refused request doesn't read categories or fetch and cache an NBU rate. Caching the rate is a write, so the
  brief's "before anything is written" needs this order.
- It leaks nothing. `month_ended` depends only on the clock, the request's date and, for PUT/DELETE/restore, the
  stored date of an expense already found in the caller's ledger. A foreign category id with a September date gets
  409 instead of 400 `unknown_category`, and neither answer says anything about the other ledger.

### Check-then-write race (decision: no transaction or lock)

The check depends only on the clock and on dates. Every write checks both ends of a move (the stored date and the
new one), so a stored date can never move into or out of an ended month. A concurrent request therefore can't
undo a check that has already passed. The one remaining gap is the clock passing 00:00 Kyiv between the check
and the write. For DELETE and restore that is one SELECT. For POST and PUT it can last as long as an uncached NBU
fetch (`AbortSignal.timeout(TIMEOUT_MS)` in `rates/nbu.ts`). A DB transaction or row lock orders writes; it can't
stop the clock, so it can't close this gap. The category routes accept the same gap: they check `monthEnded`
before their transaction (`categories/routes.ts`). A write that lands this way behaves like a request that arrived
a moment earlier. The check stays first, as the brief requires.

## Contracts

- DB: none.
- API (existing routes, new refusal; bodies unchanged):
  - `POST /api/ledgers/:id/expenses` → `201 Expense`. `409 { error: 'month_ended' }` when `expenseDate`'s month has
    ended in Kyiv, checked after Zod and before `checkCategory`.
  - `PUT /api/ledgers/:id/expenses/:expenseId` → `200 Expense`. After `loadExpense` (404), `409 month_ended` when
    the stored `expenseDate` **or** the body's `expenseDate` is in an ended month (one `at = now()` for both).
  - `DELETE /api/ledgers/:id/expenses/:expenseId` → `204`. `loadExpense(…)` null → `404 not_found`. Stored date in
    an ended month → `409 month_ended`. Otherwise `setDeleted`, whose false result (gone in the meantime) → 404.
  - `POST /api/ledgers/:id/expenses/:expenseId/restore` → `200 Expense`. `loadExpense(…, true)` (a soft-deleted
    row in this ledger) null → `404 not_found`. Stored date in an ended month → `409 month_ended`. Otherwise
    `setDeleted`, whose false result (deleted category, not in the month's list, or already restored) → 404 as today.
  - Internal: `loadExpense(ledgerId, expenseId, deleted = false)` selects `e.deleted_at IS [NOT] NULL`, a fixed SQL
    fragment as `setDeleted` already does. GET and PUT keep the default.
- App:
  - `apps/mobile/src/data/expenseLock.ts` (new, pure; dates are Kyiv `YYYY-MM-DD`, months `YYYY-MM`):
    - `firstOpenDate(today: string): string`: `'2026-10-25'` → `'2026-10-01'` (slice 3).
    - `expenseLocked(date: string, today: string): boolean`: `date < firstOpenDate(today)` (slice 4).
  - `apps/mobile/src/data/monthEnded.ts` (exists on the base, holds `monthEndedText`), gains:
    - `lockedText(month: string): string`: `'September has ended, so its expenses can’t change.'` (slice 4).
    - `restoreRefusedText(code: string, month: string): string | null`: `'month_ended'` →
      `'September has ended, so it can’t be restored.'`, any other code → `null` (slice 5). Same shape as
      `copyRefusedText`.
    - Copy uses `’` like `monthEndedText`. `{Month}` is `monthName(month)`, with no year.
  - `DateField` props: add `min: string` (web `<input min>`, iOS `minimumDate={parseDate(min)}`) and
    `disabled?: boolean` (Pressable `disabled`, `accessibilityState.disabled`). The web `onChange` also ignores a
    typed value before `min` (one-line guard next to the existing empty-value check; `max` has no such guard today).
  - `DateChips` props: add `min: string` (passed down; a chip whose date is before `min` isn't shown) and
    `disabled?: boolean` (passed to `DateField`; the Today/Yesterday chips are hidden).
  - `CategoryPicker` props: add `disabled?: boolean` (every tile and "N more" are disabled, with
    `accessibilityState.disabled`; the selected tile still shows as selected).
  - `AmountFields` props: add `disabled?: boolean` (both `TextInput`s get `editable={!disabled}`).
  - `data/undo.ts`: `PendingUndo` gains `refusedText?: (err: unknown) => string | null`, the bar's text when the
    restore is refused for good. `UndoOffer` becomes
    `{ undo; status: 'offer' | 'restoring' | 'failed' } | { undo; status: 'refused'; text: string }`.
  - `UndoToast`: `refused` shows `offer.text` with no button. It times out like the other states, since the
    existing timer covers every non-`restoring` offer.
  - Routes, hooks and DTOs: unchanged (`api/types.ts` untouched).
- Reuses: `monthEnded`, `loadExpense`, `setDeleted` (API); `data/monthEnded.ts`, `kyivToday`, `monthName`,
  `addDays`, `parseDate`, `ApiError`, `useUndoOffer`/`UndoToast`, and the form's single `today` read (app). Tests reuse `storeMonthList`,
  `authHeader`, and the `let now = clock` pattern from `categories.int.test.ts`.
- New dependencies: none.

## Slices

- [x] 1. Refuse adding or editing an expense in an ended month (~150 lines)
  - Files: `apps/api/src/expenses/routes.ts`, `apps/api/test/expenses.int.test.ts`
  - Change: import `monthEnded`. POST checks `input.expenseDate.slice(0, 7)` before `checkCategory`. PUT checks
    `current.expenseDate` and `input.expenseDate` after the 404. Add a why-comment like the category routes'
    ("An ended month is read-only (brief 028, 041), so it's refused before anything is read or priced").
    Test harness: keep `const clock`, add `let now = clock` (reset in `beforeEach`), and build the app with
    `now: () => now`.
  - Tests (new `describe('ended months')`; clock 2026-10-06; September rows are seeded by posting while
    `now = 2026-09-30T10:00:00Z`, then `now = clock`):
    - "refuses a new September expense, writing nothing": 409 `month_ended`. The `expenses` row count and the
      `exchange_rates` row count are unchanged, and `fetchRate` was never called (`asked` is `[]`).
    - "refuses editing a September expense, even within September": PUT to `2026-09-29` gives 409. A raw
      `SELECT * FROM expenses WHERE expense_id = ?` is identical before and after.
    - "refuses moving an expense into or out of an ended month": October→`2026-09-30` gives 409, September→
      `2026-10-02` gives 409, both rows unchanged. October→`2026-10-05` gives 200.
    - "says month_ended before category_not_in_month": with gym out of October's list, PUT of a September gym
      expense to `2026-10-01` gives 409 (not 400). POST to August (no list) gives 409.
    - "answers 404, not month_ended, for an unknown or other-ledger expense": PUT `999999` and a stranger's PUT on
      the September expense (September body) each give 404 `not_found`.
    - "locks a month at 00:00 Kyiv, not UTC": `now = 2026-09-30T20:59:59Z` (23:59:59 Kyiv, UTC+3), POST and PUT
      for `2026-09-30` succeed. At `now = 2026-09-30T21:00:00Z` (still the 30th in UTC, 1 October in Kyiv), both
      give 409. `dates.test.ts` already covers the UTC+2 boundary (31 Oct 22:00Z).
    - Existing tests this breaks, rewritten in the same commit (otherwise the commit isn't green):
      - `PUT › leaves the expense unchanged when the rate is unavailable`: date `2026-09-01` → `2026-10-05`. Nothing
        is cached from 10-05 back to 09-28, and `fetchRate` returns null, so it's still 503.
      - `GET` `beforeEach`: post the `'september'` row while `now` is 30 Sep.
      - `month lists › refuses a new expense in a month whose list lacks its category`: the final September 201
        becomes "restoring gym to October's list (`storeMonthList(…, '2026-10', [])`) lets it in: 201".
      - `month lists › refuses moving an expense, or switching its category, into such a month`: the cross-month
        move uses the only two open months there can be. Setup: `now = 2026-10-31T10:00:00Z` (new `auth`),
        `fetchRate = async () => 50.483`, November's list without gym. In this order: (1) create an Oct 31 gym
        expense (201); (2) move it to `2026-11-01`, which gives 400 `category_not_in_month` and leaves it unchanged
        (GET equals the created one); (3) rename it in October, which gives 200; (4) `withoutGymInOctober()`;
        (5) switch an October groceries expense to gym, which gives 400 `category_not_in_month`.
      - `month lists › refuses an expense in a month with no budget, before pricing it`: use October emptied
        (`storeMonthList` excluding every tech name) instead of August. Then `storeMonthList(…, '2026-10', [])` gives 201.
      - `month lists › won't restore an expense into a month whose list lacks its category`: drop the September half
        (it now fails at POST). Instead, put gym back in October's list and the restore gives 200.

- [ ] 2. Refuse deleting or restoring an expense in an ended month (~70 lines)
  - Files: `apps/api/src/expenses/routes.ts`, `apps/api/test/expenses.int.test.ts`
  - Change: add the `deleted` flag to `loadExpense`. DELETE and restore load first (404), then check the stored
    date's month (409), then call `setDeleted` (404 when it changed nothing).
  - Tests (in `ended months`):
    - "refuses deleting a September expense, writing nothing": 409. The raw row is unchanged (`deleted_at` null,
      `updated_at` the same).
    - "refuses restoring a deleted September expense": seed by posting and deleting while `now` is 30 Sep. Restore
      at `clock` gives 409, and the row keeps its `deleted_at`.
    - "answers 404, not month_ended, for unknown or other-ledger ids": DELETE and restore of `999999`. A stranger's
      DELETE of the live September expense and restore of the deleted one each give 404 `not_found`.
    - "an Undo just after midnight is refused" (the brief's edge case): `now = 2026-09-30T20:59:59Z`, DELETE gives 204. `now = 2026-09-30T21:00:00Z`, restore gives 409 `month_ended`.
    - Existing tests (`DELETE and restore`, the guards table) are October-only and stay unchanged. They prove 204,
      200 and the 404s still work.

- [ ] 3. Keep a new expense's date out of ended months (~40 lines)
  - Files: `apps/mobile/src/data/expenseLock.ts` (new), `apps/mobile/test/expenseLock.test.ts` (new),
    `apps/mobile/src/components/DateField.tsx`, `apps/mobile/src/components/DateChips.tsx`,
    `apps/mobile/src/app/expense.tsx`
  - Change: `firstOpenDate`. `DateField` and `DateChips` get `min` (chips before `min` aren't shown, so on the 1st
    only Today is; `DateField`'s web `onChange` ignores a value before `min`). The form passes `min={firstOpenDate(today)}` for new and edited expenses alike (see Open
    questions).
  - Tests: `expenseLock.test.ts › firstOpenDate`, table: `'2026-10-25'`→`'2026-10-01'`, `'2026-11-01'`→
    `'2026-11-01'`, `'2027-01-01'`→`'2027-01-01'`. A row composes it with `kyivToday`:
    `firstOpenDate(kyivToday(new Date('2026-09-30T21:00:00Z')))` is `'2026-10-01'`, and at `20:59:59Z` it is
    `'2026-09-01'`.
  - Verify (web 390×844, launch configs `api` + `web`): New expense → the browser calendar won't select any day
    before 1 October; September days are disabled. Today and Yesterday still work. `yarn mobile typecheck` + lint.

- [ ] 4. Show an expense of an ended month read-only (~90 lines)
  - Files: `apps/mobile/src/data/expenseLock.ts`, `apps/mobile/test/expenseLock.test.ts`,
    `apps/mobile/src/data/monthEnded.ts`, `apps/mobile/test/monthEnded.test.ts` (new),
    `apps/mobile/src/components/DateChips.tsx`, `apps/mobile/src/components/DateField.tsx`,
    `apps/mobile/src/components/CategoryPicker.tsx`, `apps/mobile/src/components/AmountFields.tsx`,
    `apps/mobile/src/app/expense.tsx`
  - Change: `expenseLocked` and `lockedText`, plus the `disabled` props. In `ExpenseForm`,
    `const locked = !!expense && expenseLocked(expense.expenseDate, today)`. When locked:
    - `lockedText(month)` shows as the first line of the form (plain `Text`, read in order by VoiceOver);
    - the date, category and amount fields are disabled, and the name input has `editable={!locked}`;
    - Update and "Delete expense" are not rendered;
    - the category alerts are off: `noBudget`/`notInMonth` are null.
      `noBudget` loses its ended-month branch. Once a form is either locked or limited to this month, that branch
      can't run. `save()` and `remove()` map an `ApiError` `month_ended` to `lockedText` instead of `errorText`.
      The month each one uses: `save()` uses `body.expenseDate.slice(0, 7)`. The locked line and `remove()` use
      `expense.expenseDate.slice(0, 7)`, the stored month, not `ExpenseForm`'s local `month` (`expense.tsx:159`),
      which follows the date being edited.
  - Tests: `expenseLock.test.ts › expenseLocked`, table: (`'2026-09-30'`, `'2026-10-01'`) true; (`'2026-10-31'`,
    `'2026-10-31'`) false; (`'2025-12-31'`, `'2026-01-01'`) true; (`'2026-10-01'`, `'2026-10-25'`) false. Kyiv
    rows: `'2026-09-30'` against `kyivToday(new Date('2026-09-30T21:00:00Z'))` is true, and at `20:59:59Z` false.
    New `apps/mobile/test/monthEnded.test.ts › lockedText`: `'2026-09'` and `'2027-01'` give exact strings.
  - Verify (web 390×844): Category screen → switch to September → tap a September expense. Date, category, name
    and amounts are shown; typing in name or amount, tapping a tile or "N more", and tapping the date do nothing.
    There's no Update and no Delete, and the line reads "September has ended, so its expenses can’t change."
    Check dark mode too. If the QA ledger has no September expense, add one before running this branch's API (from
    `main`) or with an SQL insert. An October expense still edits, saves and deletes (with Undo) as before. Server
    `month_ended`: open an October expense, run `UPDATE expenses SET expense_date = '2026-09-30' WHERE expense_id = …`
    in the dev DB, then press Update. The line "October has ended, so its expenses can’t change." shows in place
    of the generic error (the form names its own month; in the real midnight case it's the same month). Delete
    shows the same line.

- [ ] 5. Explain a refused Undo of an expense in an ended month (~45 lines)
  - Files: `apps/mobile/src/data/monthEnded.ts`, `apps/mobile/test/monthEnded.test.ts`,
    `apps/mobile/src/data/undo.ts`, `apps/mobile/src/components/UndoToast.tsx`, `apps/mobile/src/app/expense.tsx`
  - Change: `restoreRefusedText`. `useUndoOffer`'s `catch (err)` asks `undo.refusedText?.(err)`. A text gives
    `{ status: 'refused', text }` and announces the text; otherwise it stays `failed` with 'Couldn’t undo'.
    `UndoToast` renders `refused` without a button. `remove()` passes
    `refusedText: (err) => (err instanceof ApiError ? restoreRefusedText(err.code, month) : null)`, where
    `month = expense.expenseDate.slice(0, 7)` (the stored month, not the form's local `month`). Category removal's
    Undo is unchanged.
  - Tests: `monthEnded.test.ts › restoreRefusedText`: `('month_ended', '2026-09')` →
    `'September has ended, so it can’t be restored.'`, `('month_ended', '2027-01')` names January, and
    `'not_found'` and `'internal'` → null.
  - Verify (web 390×844): delete an October expense from its form. Before pressing Undo, run
    `UPDATE expenses SET expense_date = '2026-09-30' WHERE expense_id = …`, then press Undo. The bar reads "October
    has ended, so it can’t be restored." with no Retry and goes away after ~10 s. A normal delete + Undo still
    restores, and a network failure (API stopped) still shows "Couldn’t undo" + Retry.

Total ≈ 395 changed lines across 5 commits.

## AC → evidence

| AC                                                                                      | Evidence                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API: create, edit, delete, restore of a September expense → 409, DB unchanged           | Slice 1: "refuses a new September expense, writing nothing", "refuses editing a September expense…". Slice 2: "refuses deleting…", "refuses restoring…". Each compares raw rows or counts, and the rate cache, before and after |
| API: Oct→Sep and Sep→Oct edits → 409; edits within October succeed                      | Slice 1: "refuses moving an expense into or out of an ended month"                                                                                                                                                              |
| API: unknown or other-ledger id → 404, not `month_ended`                                | Slice 1 (PUT) and slice 2 (DELETE, restore): "answers 404, not month_ended…"                                                                                                                                                    |
| API: 1st locked, last day open, around midnight Kyiv incl. UTC offset                   | Slice 1: "locks a month at 00:00 Kyiv, not UTC" (UTC+3). Slice 2: "an Undo just after midnight is refused". Existing `dates.test.ts` `monthEnded` table (UTC+2)                                                                 |
| App: September expense read-only with line, no Save/Delete; October edits/saves/deletes | Slice 4 web check (390×844), incl. the server-refusal line                                                                                                                                                                      |
| App: a new expense's date can't be set in an ended month                                | Slice 3: `firstOpenDate` unit table + web check of the calendar's minimum                                                                                                                                                       |
| App unit tests for new pure logic                                                       | `apps/mobile/test/expenseLock.test.ts` (slices 3–4), `apps/mobile/test/monthEnded.test.ts` (slices 4–5)                                                                                                                         |
| Undo refused with `month_ended` says "{Month} has ended, so it can’t be restored."      | Slice 5: `restoreRefusedText` unit test + web check (SQL-moved date)                                                                                                                                                            |
| iPhone (Expo Go) checked by the user                                                    | PR test plan: user checks slices 3–5 on iPhone (calendar minimum in the iOS sheet, read-only September form, Undo bar)                                                                                                          |
| Gates green                                                                             | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit, with `DATABASE_URL_TEST` exported so the API integration tests run (they skip silently otherwise)                                           |

## Not doing (YAGNI)

- No grace period and no admin/CLI override (brief: out of scope).
- No changes to the Category screen, Expenses tab or Home (Add is already hidden in ended months).
- No `refusedText` on category removal's Undo, although `restoreToMonth` can also answer `month_ended` across
  midnight (Follow-ups).
- No replacing the screens' inline `month < thisMonth` checks with `expenseLock`: that's a separate refactor, and
  those checks are about months, not expenses.
- No new title ("Expense" vs "Edit expense") for the read-only form. `ExpenseScreen` renders the title before the
  draft loads, and the brief doesn't ask for one.
- No dimming of read-only fields. They are values to read, and the line explains why they can't change.
- No transaction or lock around the month check (see Approach).
- No DTO or route additions (no `locked` flag from the server). The app derives it from the date it already has.

## Risks

- **Existing API tests depend on writing September/August expenses** (5 tests listed in slice 1). If more break,
  slice 1 isn't green. Slice 1 finds out by running the full `expenses.int.test.ts` with `DATABASE_URL_TEST`
  exported. No other test file calls the expense write routes (`rg "/expenses" apps/api/test` shows only
  `categories.int.test.ts`, whose DELETE is on an October row, and GET-only uses).
- **Moving `now` back to 30 Sep after the session was created at `clock`** could invalidate the session. Disproved
  by precedent: `categories.int.test.ts` does the same (`now = 2026-09-30T20:59:59Z` with an Oct 6 session). Slice
  1's first seeded test confirms it.
- **Midnight gap** (Approach): a POST/PUT whose uncached NBU fetch spans 00:00 Kyiv can still write into the month
  that just ended. Accepted, as in the category routes. No slice changes this. The reviewer should check that the
  month check comes before `price()`.
- **iOS picker with `minimumDate`** when the value is below it (a locked September form): the picker never opens
  because the field is disabled, and `Modal` doesn't mount its children while hidden. Between slices 3 and 4 an
  editable September form briefly exists (the server already refuses its save). Slice 4's web check plus the
  user's iPhone check prove the final state.
- **Shared text module with 038**: #53 is on the base. Of its files, this plan touches only `data/monthEnded.ts`,
  adding two functions next to `monthEndedText`, so all "has ended" copy stays in one module. The base's
  `monthEnded.ts` has no test file yet. Slice 4 creates `monthEnded.test.ts`, and slice 4's gates confirm the new
  file runs under `yarn mobile test`.
- **No QA data in September**: the slice 4 web check needs a September expense in the local QA ledger. The API on
  this branch can't create one, so add it from `main` or with SQL before switching (noted in slice 4).

## Open questions

- no — Does the date minimum also apply when editing a current-month expense? Assumed **yes**: one `min` for the
  form. The server refuses moving it into an ended month anyway, so this only removes a pointless refusal.
- no — When the server answers `month_ended` to a save or delete (the month ended with the form open), should the
  form also lock (hide Update/Delete)? Assumed **no**: the brief only says "shows the same line instead of a generic
  error". The line goes in the existing error slot, and Cancel is the way out.
- no — Should the refused Undo bar keep Retry? Assumed **no**: retrying can't help, so the bar shows only the text
  and times out after the usual 10 s (the `delete-category.tsx` "gone" pattern).
- no — Where does the read-only line go? Assumed: first line of the form, above Date, so it's visible without
  scrolling at 390×844. The Today/Yesterday chips are hidden while read-only.

## Follow-ups

- Category screen rows in an ended month still say `accessibilityHint="Edit this expense"`
  (`category/[categoryId].tsx:149`). For a September row that now opens read-only, "View this expense" would be
  accurate.
- Category removal's Undo (`delete-category.tsx` → `restoreToMonth`) can also get `month_ended` across midnight and
  shows the generic "Couldn’t undo" + Retry. Adding a `refusedText` that uses `monthEndedText` is now a 1-line
  change (`monthEndedText` is on main).
- Conventions §3 lists only remove/restore as refused for ended months. Proposal (not a slice): "Every write that
  touches an ended month (Kyiv) is refused (`409 month_ended`): month lists, names, planned amounts, Copy and,
  since 041, expenses."

## Deviations

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

## Revision 1

Skeptic: approve with edits. The base moved to cc420d6, which includes #53. `lockedText` and `restoreRefusedText`
moved to `data/monthEnded.ts` next to `monthEndedText`, with tests in the new `monthEnded.test.ts`, and the "two
text modules" risk was replaced. Slice 1 spells out the steps of the rewritten cross-month test. Slices 4–5 name
the month each message uses. `DateField`'s web `onChange` ignores values before `min`. Slice 1 is now ~150 lines,
total ~395. The category-removal Undo follow-up now points to `monthEndedText` on main.

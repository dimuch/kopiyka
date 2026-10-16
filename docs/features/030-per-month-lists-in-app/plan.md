# Plan: Per-month category lists in the app (per-month categories, part 3 of 4)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/per-month-lists-in-app
Base: origin/main @ ddd8b49

## Approach

All of this is app work except one small API change at the end.

- **Month screens.** `useMonth` sends `?month=`, so Home, the Expenses tab and the Category screen each get the list
  of the month they show. When the Category screen's category isn't in its month, the screen still needs the name
  for “eating out” isn’t in October. It gets it from `useCategoryTotals`, the existing `GET one` without `month`
  (all months), which 018 already uses. That request also tells a missing category (404) apart from one that is
  only missing from this month.
- **Expense form.** `useExpenseDraft` stops loading categories and only loads the expense being edited. A new hook,
  `useMonthCategories(ledgerId, month)`, loads the list and quick row for the month of the form's date. It loads
  again whenever that month changes.
  - The quick row and "More" are worked out on each render by a new pure `monthPicker` in `data/quick.ts`. It also
    reports `missing`: a category is selected, but that month's list doesn't have it.
  - When `missing` is true, the message "That category isn’t in October." shows under the picker and Save sends
    nothing. The API's `category_not_in_month` shows the same text.
  - A new expense with no category given defaults to the first quick tile of the month the form opened in. That
    default stays fixed when the date moves (Gate A). The hook records it from its first ready load.
- **Ended months (Gate A).** The Category screen has no "+" for a month that has ended in Kyiv time
  (`month < kyivMonth(now)`).
- **API.** The last slice makes `month` required on `GET …/categories`. Every app caller sends it by then.

Alternative considered: keep the form's first list in `useExpenseDraft` and use a second hook only after the date
moves to another month. That gives two code paths for one list and makes edits load the list twice. Rejected.

## Contracts

- **DB:** none.
- **API:** `GET /api/ledgers/:id/categories?month=YYYY-MM` → `200 { categories: CategoryDto[], quickCategoryIds: number[] }`.
  The body is unchanged.
  - `month` is now required (`ListQuery` without `.optional()`), and the `kyivToday` default goes.
  - A missing or malformed month gives `400 { error: 'invalid_request', … }` from the global Zod handler.
  - Precedence is unchanged: `401 unauthorized` and `404 not_found` (non-member) come from the preHandlers, before
    the 400.
  - `GET one` (with `month` still optional) and every other route stay unchanged.
- **App, `apps/mobile/src/data/useMonth.ts`:** the signature stays the same. The categories request becomes
  `/api/ledgers/${ledgerId}/categories?month=${month}`. JSDoc: "The month's categories plus its expenses …".
- **App, `apps/mobile/src/data/useMonthCategories.ts` (new):** built like `useCategoryTotals` (a `useEffect` and a
  key-tagged result, not reloaded on focus). The form is its only caller. It lives in `data/` because the
  conventions put data loading there (§2, §5).

  ```ts
  export type MonthCategories = {
    reload: () => void;
    /** The first quick category of the first list that loaded; null before that. Fixed afterwards. */
    firstQuickId: number | null;
  } & ({ status: 'loading' } | { status: 'error' } | { status: 'ready'; categories: Category[]; quickIds: number[] });
  /** A 'YYYY-MM' month's categories and its quick row, for the expense form; loads again when `month` changes. */
  export function useMonthCategories(ledgerId: number, month: string): MonthCategories;
  ```

  `firstQuickId` is its own state, not tagged with the key. It is set only in the request's `.then`, next to the
  loaded list: `setFirstQuickId((id) => id ?? c.quickCategoryIds[0] ?? null)`. Nothing is set synchronously in the
  effect, and a response dropped as stale (`live` false) doesn't set it.

- **App, `apps/mobile/src/data/useExpenseDraft.ts`:** `ExpenseDraftData` becomes
  `{ expense: Expense | null; categoryId: number | null }`.
  - `categoryId` is the expense's category, else the requested one, else null. When it's null, the form takes the
    hook's `firstQuickId`.
  - `categories`, `quickIds` and `toDraft` are removed. The hook signature is unchanged.
- **App, `apps/mobile/src/data/quick.ts`:**

  ```ts
  /**
   * The form's tiles for one month's list: the quick row (with the selected category in it when the month has it)
   * and the rest for "More". `missing` is true when a category is selected but the month's list lacks it.
   */
  export function monthPicker(
    categories: Category[],
    quickIds: number[],
    selectedId: number | null,
  ): { quick: Category[]; more: Category[]; missing: boolean };
  ```

  It is built from the existing `withQuick` and `splitQuick`, and both stay exported.

- **App, copy (screens):**
  - Category screen: `“${displayName}” isn’t in ${monthName(month)}.`. An unknown or deleted id (`GET one` 404) still
    shows "Category not found.".
  - Expense form: `That category isn’t in ${monthName(month)}.`. The month comes from the form's date (live), or
    from the sent `expenseDate` (API `category_not_in_month`).
- **App, `apps/mobile/src/api/types.ts`:** no change. The list's response type stays inline, as it is today.
- **New dependencies:** none.

## Slices

- [x] 1. Show each month's own categories on Home, Expenses and the Category screen
  - Files: `apps/mobile/src/data/useMonth.ts`, `apps/mobile/src/app/category/[categoryId].tsx`.
  - Change, `useMonth`: add `?month=${month}` to the categories request.
  - Change, Category screen: replace the `!category` branch's "Category not found." with a local `NotInMonth`
    component (`{ categoryId, month }`) that calls `useCategoryTotals(ledger.ledgerId, categoryId)`:
    - loading: `ActivityIndicator`;
    - error `ApiError` `not_found`: `LoadError` "Category not found." (no Retry);
    - any other error: `LoadError` "Couldn’t load this category. Check your connection and try again." with Retry
      (`reload`);
    - ready: `LoadError` with `“${displayName}” isn’t in ${monthName(month)}.`, without Retry.

    "+" stays hidden whenever the month's list lacks the category.

  - Change, ended month (Gate A):
    - `CategoryScreen` passes `ended={month < thisMonth}` to `CategoryBreakdown`. `thisMonth` is the existing
      `kyivMonth(new Date())` state, and 'YYYY-MM' strings compare in calendar order.
    - `showAdd = !ended && (!data || !!category)`, with the comment "an ended month is read-only (brief 028)".
    - No new helper, so no unit test: it is one comparison of values that already exist.
  - Verify (web 390×844, `claude-qa-030`, setup under Risks):
    - October's Expenses tab has no "eating out", and September's shows it with its amount.
    - `/category/<eating_out id>?month=2026-10` shows the new text without "+" or ⋯.
    - September's eating out (from the Expenses tab) shows its expense and has no "+".
    - A category October has (for example groceries) shows "+" in October and in November.
    - `/category/999999?month=2026-10` shows "Category not found.".
    - Home's Expenses figure equals October's total.
  - ≈ 45 lines.
- [x] 2. Work out the form's category tiles for one month
  - Files: `apps/mobile/src/data/quick.ts`, `apps/mobile/test/quick.test.ts`.
  - Change: `monthPicker` as in Contracts.
  - Tests, `quick.test.ts` › `monthPicker`, with categories 1–6 and quick `[1, 2]`:
    - selected 5, in the list but not quick: quick `[1, 2, 5]`, more `[3, 4, 6]`, `missing` false;
    - selected 9, not in the list: quick `[1, 2]`, more `[3, 4, 5, 6]`, `missing` true;
    - selected null: quick `[1, 2]`, `missing` false;
    - a full quick row `[1, 2, 3, 4, 5]` and selected 9, not in the list: quick `[1, 2, 3, 4, 5]` (9 doesn't take the
      last spot), `missing` true.
  - ≈ 40 lines.
- [x] 3. Offer the categories of the date's month in the expense form
  - Files: `apps/mobile/src/data/useMonthCategories.ts` (new), `apps/mobile/src/data/useExpenseDraft.ts`,
    `apps/mobile/src/app/expense.tsx`.
  - Change, `ExpenseForm`:
    - `const month = date.slice(0, 7)` and `const list = useMonthCategories(ledgerId, month)`.
    - The `quick` state is removed. The `categoryId` state starts from `draft.categoryId`.
    - `selectedId = categoryId ?? list.firstQuickId`. This replaces Revision 1's render-time `quickIds[0]` fallback
      (Gate A). The default doesn't follow the date. If the new month lacks it, `missing` and the Save refusal apply
      as for any selected category.
    - `monthPicker(list.categories, list.quickIds, selectedId)` feeds `CategoryPicker`, and
      `notInMonth = picker.missing ? 'That category isn’t in …' : null`.
    - VoiceOver: an effect announces `notInMonth` whenever it changes to a text, like `LoadError`'s effect (about 3
      lines). The `alert` role covers web.
  - Change, the Category group:
    - loading: an accent `ActivityIndicator`;
    - error: `LoadError` "Couldn’t load the categories. Check your connection and try again." with Retry
      (`list.reload`);
    - ready: the picker, then `notInMonth` as `<Text accessibilityRole="alert" style={styles.error}>`.
  - Change, `save()`:
    - The empty-field check and the request body use `selectedId`, not the `categoryId` state.
    - It returns early unless `list` is ready. The Add/Update button is also `disabled` with the busy opacity while
      the list isn't ready.
    - When `notInMonth` is set, it calls `AccessibilityInfo.announceForAccessibility(notInMonth)` and returns before
      `saveExpense`.
    - In the catch, `ApiError` `category_not_in_month` shows the same text for `body.expenseDate`'s month. Any other
      error goes through `errorText` as today.
    - The "Added …" note takes the name from `list.categories`.
  - Verify (web 390×844, QA ledger, eating_out removed from October):
    - A new expense dated today has no "eating out" in the quick row or in More.
    - Pick a September date, then "eating out" from More. Then press Today: the message appears. Add sends no POST
      (DevTools Network), and October's list is unchanged.
    - Pick the September date again: the message goes away, Add saves, and September's total rises by the amount.
    - Editing that September expense opens with "eating out" selected.
    - A new expense with no category picked (opened from Home's +) saves into the first tile in the month's quick
      row.
    - Open "+" from Home in October with no category, then pick a September date. The default stays the same tile
      (September's list has it too), and Add saves it there.
    - Stop the API and change the month: the category error with Retry appears. Start the API and press Retry: the
      picker returns.
    - Checked in Light and Dark.
  - ≈ 125 lines.
- [ ] 4. Require the month on the category list
  - Files: `apps/api/src/categories/routes.ts`, `apps/api/test/categories.int.test.ts`,
    `apps/api/test/expenses.int.test.ts`, `apps/api/test/migrations.int.test.ts`.
  - Change: `ListQuery`'s `month` is required, with the comment "every caller sends it since brief 030". The
    `kyivToday` default and its import go (`now` is still used by the month routes).
  - Tests:
    - `categories.int.test.ts`:
      - The `get` helper sends `?month=2026-10`. The clock is 2026-10-06, so it asks for the same month the default
        gave before.
      - The test "lists the current Kyiv month's categories without a month" becomes "requires a month":
        `GET …/categories` and `?month=` (empty) each give 400 `toMatchObject({ error: 'invalid_request' })`.
      - The seeded, quick row, deleted, 401, 404, non-numeric id, and 013 delete/restore tests then pass unchanged.
    - `expenses.int.test.ts` `beforeEach` (line 57) and `migrations.int.test.ts` (line 114) add `?month=2026-10`.
  - ≈ 25 lines.

Total ≈ 235 changed lines, tests included. The order keeps every commit working: the app sends `month` (slices 1
and 3) before the API requires it (slice 4).

## AC → evidence

| AC                                                                                          | Evidence                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web: October's Expenses tab and form lack "eating out"; September's tab shows it with spend | Slice 1 verify (Expenses tab, Oct vs Sep). Slice 3 verify (form dated today: quick row and More). `quick.test.ts` › monthPicker (a category not in the list stays out)                   |
| Web: form, September → October shows the message, no send; back to September clears, saves  | Slice 3 verify (message, no POST in Network, then the save). `quick.test.ts` › monthPicker `missing` true/false                                                                          |
| Web: Category screen in October shows “eating out” isn’t in October. without "+"            | Slice 1 verify (`?month=2026-10` shows the text with no "+"; September's shows the expense, with no "+" because it has ended)                                                            |
| API: `GET …/categories` without `month` answers 400; existing tests updated                 | Slice 4: `categories.int.test.ts` › month lists › requires a month. `get` helper, `expenses.int.test.ts` and `migrations.int.test.ts` updated and green                                  |
| Light and Dark; iPhone (Expo Go): month switcher and the form's message                     | Slice 3 verify in both themes on web. Before the PR, on iPhone via Expo Go on the QA user: Expenses ‹ › between September and October, and the form's message after Today                |
| Gates green                                                                                 | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit. `DATABASE_URL_TEST` is exported from the main checkout's `apps/api/.env`; check the MySQL suites ran |

## Not doing (YAGNI)

- Any removal UI, the ⋯ menu change, and 018's all-months delete and its copy (part 4, brief 031).
- Making `GET one`'s `month` required (part 4), and mapping `month_ended` in the app (the lock brief). No call made
  in this brief can return `month_ended`.
- Opening the form on the Category screen's month from its "+". Ended months have no "+" now (Gate A). The current
  and future months' "+" opens on today, as now.
- The rest of the ended-month lock stays in its own brief: the form's date chips and picker, editing, deleting and
  restoring past expenses, and the API's `month_ended` refusal for expenses.
- Keeping a category picked from More in the quick row after another one is picked. The row is now worked out per
  month (see Open questions).
- A shared `CategoryList` DTO type, caching lists per month, or keeping the previous month's tiles on screen while
  the next month loads.
- A month whose list is empty: no categories shows an empty picker, as for a ledger with none.
- Separate copy for an unknown or deleted `?categoryId=` link. It now shows "That category isn’t in October." when
  the form opens, instead of "That category is no longer available." at save time.

## Risks

- **QA setup, on the QA ledger only.**
  - In `apps/api`, run
    `npx tsx --env-file=<main checkout>/apps/api/.env scripts/create-user.ts --username claude-qa-030 --email claude-qa-030@example.test`.
    Don't use `yarn api create-user --env-file=…`: the script's `parseArgs` rejects the unknown option. Keep the TOTP
    secret in the scratchpad.
  - Log in on web (`http://127.0.0.1:8084` from the worktree, or `:8081`). Add an "eating out" expense dated in
    September, and one in October.
  - Check `GET /api/ledgers` shows only the QA ledger. Then remove the category from the browser console:
    `fetch('http://127.0.0.1:3000/api/ledgers/<qa id>/categories/<eating_out id>/months/2026-10', { method: 'DELETE', credentials: 'include' })`.
    The host must match the page's (`127.0.0.1` for `:8084`, `localhost` for `:8081`), or the session cookie isn't
    sent.
  - The API's ledger guard answers 404 for ledger 1 from this session, so ledger 1 can't be touched. Never press Sync.
  - Delete the user and its ledger after the PR, in the cleanup order from the QA notes.
  - Proven by slice 1's verify.
- **The API on :3000 may be the main checkout's.** That's fine for slices 1–3, because they only add `month`. Slice
  4's 400 is proven by its integration test, not on web. Check the API's cwd with `lsof` before trusting a manual
  result.
- **Fast date changes could show a stale month's list.** The hook's key includes the month and drops late responses
  (`live`), like `useMonth`. Slice 3's verify switches September → Today → September quickly.
- **React Compiler lint on the derived selection** (no state set in effects). `selectedId` and `picker` are computed
  in render, so slice 3's lint run settles it.
- **Integration tests skip silently in a worktree** without `DATABASE_URL_TEST`. Slice 4 must show the categories
  suite as run, not skipped.

## Open questions

- **No.** The Category screen reads the missing category's name from `GET one` without `month` (all months), through
  `useCategoryTotals`. 028's outline makes that `month` required in part 4, so this would be a second caller there.
  Assumption meanwhile: use it now. Brief 031's plan keeps a month-free read for this screen, or finds the name
  another way. Recorded under Follow-ups.
- **No.** Picking from More still puts the picked category in the quick row. Before, it stayed there after another
  pick. Now only the selected one is added, because the quick row is worked out for each month. Assumption
  meanwhile: acceptable.
- **Decided at Gate A (user): "Keep first default".** A new expense with no category given keeps the first quick
  category of the month the form opened in, whatever the date becomes. If the new month lacks it, the form shows the
  message.
- **No.** While the date's month list loads, the Category area shows a spinner and Add/Update is disabled. If the
  load fails, it shows a Retry. Assumption meanwhile: as described.
- **No.** The live message shows under the category picker. A refused save shows the same text in the usual error
  place above Save. Assumption meanwhile: as described.

## Follow-ups

- Brief 031: 018's ⋯ "Delete category" still shows on an ended month's Category screen (seen in slice 1's check on
  September) and deletes the category in every month, past expenses included. 031 replaces it with "Remove from
  {Month}" and must hide it on ended months (read-only, brief 028).

- Brief 031: when `GET one` gets a required `month`, keep the Category screen's “… isn’t in October.” name read
  working (slice 1's `NotInMonth`).
- `apps/mobile/src/linkParams.ts`: the comment says `MONTH_RE` mirrors `apps/api/src/expenses/routes.ts`. Since 028
  it lives in `apps/api/src/dates.ts`.
- `apps/mobile/src/api/types.ts`: the JSDoc for `CategoryWithTotals` still says "across all months". The API also has
  `?month=` since 029. Update it when the app first sends `month` to `GET one` (031).

## Deviations

<filled by the developer during build>

## Revision 1

- Skeptic #9 (required): slice 3's `selectedId` is
  `categoryId ?? (list.status === 'ready' ? (list.quickIds[0] ?? null) : null)`. `save()` checks and sends
  `selectedId`, not the `categoryId` state, which is null for a new expense, so the default category saves. A verify
  step for Home's + was added.
- Suggestions taken:
  - (a) A `monthPicker` case with a full quick row and a missing selection.
  - (b) A Not doing line: an unknown `?categoryId=` link shows the month message when the form opens.
  - (c) A VoiceOver announcement of `notInMonth` when it changes.
  - (d) QA setup: `create-user` runs via `npx tsx --env-file=…`, and the console `fetch` uses the page's host.
  - (e) The `[7, 1]` case is dropped, because it repeated the `splitQuick` test.
- Slice sizes are unchanged at about 40, 40, 120 and 25 lines.

## Revision 2 (Gate A)

- **The default is the category the form opened with** (user: "Keep first default").
  - `useMonthCategories` gains `firstQuickId`. It is set once, in the first ready load's `.then`, and never in an
    effect body.
  - The form's `selectedId` is `categoryId ?? list.firstQuickId`, so the default doesn't follow the date.
  - Slice 3 gains a verify step: open from Home's + in October, move to September, and the default is kept and saves.
    Slice 3 is now about 125 lines.
- **No "+" on the Category screen for an ended month** (user: "user can't add changes to the passed month").
  - `ended = month < thisMonth`, using the existing `kyivMonth` state. No helper.
  - Slice 1 gains verify steps: September has no "+", while October and November have it. Slice 1 is now about 45
    lines.
  - Not doing now keeps the rest of the ended-month lock in its own brief. The skeptic's question about September's
    "+" opening a form dated October no longer applies.
- Total is now about 235 lines.

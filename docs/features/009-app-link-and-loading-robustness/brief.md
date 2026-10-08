# App links, navigation and loading robustness

Type: fix

## Why

Small rough edges collected during briefs 005–008. Each one shows the user something wrong or leaves them stuck:

- **Saving or deleting an expense opened from a link strands you.** Cancel and Back fall back to Home when there's
  no history (`leave` in `app/expense.tsx:73`), but a successful Update (`:172`) and Delete (`:195`) call
  `router.back()` directly. On web, an Edit page loaded straight from a URL then has nowhere to go.
- **Home says €0.00 while a month loads.** `total` is `0` until `rows` arrive (`app/index.tsx:26`), so the card and
  the compact total show "€0.00" for a moment, which reads as "you spent nothing".
- **Malformed links aren't recognised as malformed:**
  - `/expense?categoryId=abc` passes `NaN` to the draft (`expense.tsx:70`). The form starts with no valid category, and
    Add then says "Add a name and an amount first.", which isn't the problem.
  - `/category/abc` turns into `NaN`, which `useMonth` treats as "no category", so it loads the whole month before
    showing "Category not found." (`app/category/[categoryId].tsx:21`, `data/useMonth.ts:27`).
  - `/category/<id>?month=2026-13` (or `month=abc`) reaches the API, which rejects it (`invalid_request`). The screen
    then says "Check your connection" and the header shows a garbage month name.
- **The category sheet doesn't close on wide web.** On web the modal covers the whole window, but only the area inside
  the 402px column is a close target (`components/CategorySheet.tsx`). Clicking the margin outside it does nothing.

## What

- **Leaving the Expense screen always works.** After a successful Update or Delete, the screen leaves the same way
  Cancel does: back if there's history, else to Home. The Undo offer after Delete still appears on the screen you land
  on when that is the category screen; on Home it isn't offered (same as today when coming from Home).
- **Home shows loading, not zero.** Until the month's data has loaded, the total on the card and the compact header
  total show a neutral placeholder ("—" or a spinner, planner's choice, matching the Budget "—" style), not "€0.00".
  Once loaded, "€0.00" for an empty month is still shown as today.
- **Link params are validated in the app before anything is fetched:**
  - `expenseId` and `categoryId` must be positive integers; `month` must be `YYYY-MM` with a month 01–12.
  - A malformed `categoryId` on `/expense` is ignored: the form opens as if none was given (first quick category).
  - A malformed `categoryId` on `/category/...` shows "That link isn't valid." with Back, without loading the month.
  - A malformed `month` on `/category/...` shows the same message with Back; an empty or missing one still opens the
    current Kyiv month (from 005).
  - A malformed `expenseId` keeps today's behaviour ("That link isn't valid."), but is caught in the app rather than by
    an API round trip.
  - The parsing is pure functions in `format.ts` (or a small new module beside it), with Vitest unit tests (the app
    runner from brief 010).
- **The sheet closes from anywhere outside it.** On web at 1440×900, clicking anywhere outside the sheet, including
  the margins beside the column, closes it. The sheet itself stays in the column (008).

## Acceptance criteria

- [ ] Web, 390×844: open `/expense?expenseId=<id>` directly in a fresh tab, change the name, Update → lands on Home
      with the change saved; no error, no blank page. Same for Delete (lands on Home, expense gone).
- [ ] Navigating Home → Category → expense → Update / Delete still returns to the category screen, and Delete still
      offers Undo there.
- [ ] Home with the network throttled: while the month loads, neither the card nor the compact total shows "€0.00".
      A month with no expenses shows "€0.00" once loaded.
- [ ] `/expense?categoryId=abc` opens New expense with the first quick category selected, and Add works.
- [ ] `/category/abc?month=2026-10` shows "That link isn't valid." with Back, and no `/expenses` request is made
      (network panel).
- [ ] `/category/<id>?month=2026-13` and `?month=abc` show "That link isn't valid." with Back; the header shows no
      garbage month name. `/category/<id>` (no month) still opens the current month.
- [ ] `/expense?expenseId=abc` shows "That link isn't valid." with no API request for the expense.
- [ ] Web 1440×900: the category sheet closes on a click in the side margin outside the column, and on the backdrop
      above the sheet; clicking inside the sheet doesn't close it. iPhone (Expo Go): the sheet behaves as before.
- [ ] Unit tests cover the param parsers: valid values, `abc`, `0`, negative, decimal, empty, `2026-13`, `2026-1`.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green; no new lint suppressions.

## Out of scope

- Home's total ignoring expenses in since-hidden categories (see Open questions).
- API-side follow-ups: telling "ledger gone" from "expense gone" (`requireLedger` returns `not_found`), and pruning
  old `login_throttle` rows.
- Deep-link handling on native (iOS universal links); this is about web URLs and router params.
- Any change to the Undo mechanism itself.

## Notes

- Depends on 010 (app unit test runner), which runs first.
- `leave` already exists in `expense.tsx`; reusing it for the post-save and post-delete exits is the expected shape.
- `useExpenseDraft` currently forwards a `NaN` `expenseId` to the API on purpose so it comes back as
  `invalid_request` (`data/useExpenseDraft.ts:66`). With validation in the screen, that comment and path change.
- The API already validates `month` with `/^\d{4}-(0[1-9]|1[0-2])$/` (`apps/api/src/expenses/routes.ts:59`); mirror it.

## Open questions

- Home's monthly total and category rows ignore expenses in since-hidden categories (the rows only list active
  categories). Showing them needs a product decision (e.g. an "Other / hidden" row), so it's left out here.
  Recommend a separate brief if you want it.

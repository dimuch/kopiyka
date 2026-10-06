# Expense screen data hooks

Type: chore

## Why

`apps/mobile/src/app/expense.tsx` (~450 lines) loads categories, the expense being edited and
the NBU rate inline (`:82-124`), against conventions §2/§5 ("data loading = a hook in `data/`"):

- The load effect has no unmount guard.
- It offers no retry.
- `not_found` while loading an edited expense says "Check your connection".
- A since-hidden category is faked with the sentinel `techName: 'hidden'` (`:102,141`).
- The rate label claims the rate is for the chosen date even when the API fell back to an
  earlier day (`:194`).
- Error mapping misses `internal` and `invalid_request` (`:30-38`).
- The busy button has no accessible name (`:337-351`).

Audit: `docs/audits/2026-10-architecture.md` M4, M11, M14, M16, M17, M24.

## What

- `data/useExpenseDraft.ts` loads categories, quick ids and (when editing) the expense, with a
  `live` guard. It returns `{ status: 'loading' | 'ready' | 'error', error, reload, … }`. A
  since-hidden category is marked by id, not by a fake `techName`.
- `data/useRate.ts` returns `{ status: 'loading' | 'ok' | 'unavailable', eurUah, rateDate }` for
  a date, with a `live` guard.
- The screen uses both hooks:
  - On a load error it shows a message and a **Retry** that calls `reload`.
  - It says "This expense was deleted" for `not_found`.
  - It maps `internal` and `invalid_request` to their own text.
- The rate label shows the rate with 4 decimals, and names the fallback date when `rateDate` differs.
- The busy Add/Update button keeps its accessible name and exposes `accessibilityState`. The
  error-state Back button has `accessibilityRole="button"`.
- The Undo toast after a delete uses the expense's saved name, not the edited one.

## Acceptance criteria

- [ ] `expense.tsx` contains no `api(` calls and no `useEffect` that fetches; `data/useExpenseDraft.ts`
      and `data/useRate.ts` exist and are the only places the screen's reads happen.
- [ ] With the API stopped, opening Add expense shows an error with a Retry button. Starting the API
      and pressing Retry loads the form without leaving the screen (web build, phone width).
- [ ] Opening `/expense?expenseId=<deleted id>` shows "This expense was deleted" with Back.
- [ ] Editing an expense in a since-hidden category shows that category selected, and it does not
      appear in the "more" list. A real category whose tech name is `hidden` would still be listed
      (code review: no string sentinel).
- [ ] When the rate for the chosen date falls back to an earlier day, the label shows that day;
      the rate always has 4 decimals.
- [ ] Leaving the screen while it loads produces no React state-update warning in the console.
- [ ] VoiceOver/screen reader: the Add button announces "Add" (busy) while saving.
- [ ] `expense.tsx` is ≤ ~300 lines; `yarn lint typecheck` green; iOS and web paths both checked
      and recorded in the PR.

## Out of scope

- The shared `LoadError` component and Home/Category retries (brief 005). This brief may inline
  a simple retry; 005 replaces it.
- Splitting presentational pieces (`CategoryPicker`, `AmountFields`, `DateChips`) into
  `components/`, unless needed to reach the line target.
- Any API change. `rateDate` is already returned by `/api/rates/eur-uah`.
- A data-fetching library.

## Notes

- Builds on 003 (the amount field is already derived, so the hook split moves fewer effects).
- Keep `errorText` and `confirmDelete` in the screen; the conventions place them there.

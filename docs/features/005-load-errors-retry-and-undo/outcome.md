# Outcome: Load errors with retry, and a reliable Undo

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#17](https://github.com/dimuch/kopiyka/pull/17) Load errors with retry, and a reliable Undo — before versioning

## Decided

- `useMonth` tags its data with ledger, month and category, and its error with the attempt. A month switch shows the
  spinner, a focus refetch keeps the data, Retry clears the error at once, and the `exhaustive-deps` suppression went.
- One `LoadError` (announced on iOS, an alert on web) serves Home, Category and the expense screen, whose error view
  now keeps the form's header and safe-area edges. The header Cancel got the `canGoBack()` fallback.
- Undo moved to `restoreExpense` in `data/expenses.ts`. The toast goes offer, restoring, failed, and closes only on
  success or after 10 s, never while a request is in flight.
- A restore that finds nothing shows "Couldn't undo" like any failure. Only deviation: the hide-Add condition became
  a `showAdd` variable.

## Left out

- Pull-to-refresh, offline detection, caching or a data-fetching library (out of scope).
- Telling "ledger gone" from "expense gone": no ledger could vanish mid-session then.

## Follow-ups

- After Update, `router.back()` does nothing on a direct web load — done in 009, #21
- Home's total reads €0.00 while a month loads — done in 009, #21
- "Ledger gone" vs "expense gone" on the expense load error — done in 052, #66
- A malformed `month` param offers a Retry that can't help — done in 009, #21

Full plan: `git show 031564a1:docs/features/005-load-errors-retry-and-undo/plan.md`

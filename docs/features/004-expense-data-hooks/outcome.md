# Outcome: Expense screen data hooks

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#15](https://github.com/dimuch/kopiyka/pull/15) Expense screen data hooks — before versioning

## Decided

- At Gate A the component moves were split out into brief 007 (#14), which shipped first, and the line target was
  relaxed to about 320.
- Reads moved into `data/useExpenseDraft.ts` and `data/useRate.ts`. Each tags its result with its request, so a new
  request reads as loading without a set-state in the effect. Writes moved to `data/expenses.ts`, so the screen makes
  no `api(` calls.
- The form mounts once the draft has loaded and seeds its state from it. The draft loads once per open, not on focus,
  so nothing typed is lost.
- The delete prompt and the Undo toast use the saved name. `expense.tsx` ended at 321 lines, not 317, because of
  why-comments.

## Left out

- The shared `LoadError` and the Home and Category retries (brief 005).
- Prefetching the rate alongside the draft, and web `aria-*` props.

## Follow-ups

- The header Cancel needs the `canGoBack()` fallback — done in 005, #17
- The load-error view: announce it, keep the form's header, tell "ledger gone" apart — done in 005, #17 and 052, #66
- `useMonth` could use the same request tagging — done in 005, #17
- Audit M12 (`{editingId && …}`) went away here, so 006 could drop it — done in 006, #18
- On web, `accessibilityState` (selected, busy) renders nothing — in BACKLOG.md

Full plan: `git show ba84e5f0:docs/features/004-expense-data-hooks/plan.md`

# Outcome: Delete an expense at once, with Undo

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#57](https://github.com/dimuch/kopiyka/pull/57) Delete an expense at once, with Undo — before versioning

## Decided

- The expense form's Delete goes straight to the DELETE with no confirm question; Undo is the way back, as the user
  chose.
- An `inFlight` ref stops a second press in the same tick, as in `delete-category.tsx`.
- A browser that blocks `confirm()` was checked by stubbing it to return `false`.

## Left out

- Any change to Undo, the delete and restore API, or category removal (out of scope in the brief).
- Guarding Save against running at the same time as Delete: `busy` already disables both.
- Rewording the audit doc or old plans that mention `confirmDelete`: they record history.

## Follow-ups

None.

Full plan: `git show d49c41fd:docs/features/043-delete-expense-without-confirm/plan.md`

# Outcome: Undo that finds nothing to bring back

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#60](https://github.com/dimuch/kopiyka/pull/60) Undo that finds nothing to bring back — before versioning

## Decided

- Gate A chose option A: one fixed line for both Undo callers, "Already restored or deleted — nothing to undo.", with
  no Retry; option B (naming the category or expense) was declined.
- The change lives in `restoreRefusedText` only, so both callers stayed as they were.
- It also says "deleted" when the category was only removed from the month meanwhile; accepted as close enough.
- Built as planned, with no code deviations.

## Left out

- Any API change, or Retry handling for `name_taken` (out of scope in the brief).
- Refreshing the list behind the bar after the 404: it refreshes on the next focus.
- Moving `restoreRefusedText` out of `monthEnded.ts`, and a screen-level test of the wiring.

## Follow-ups

- Move `restoreRefusedText` to a module named for Undo refusals if a third kind arrives — dropped: no third kind came
  to `monthEnded.ts`.

Full plan: `git show 9ccfcd73:docs/features/046-undo-refused-not-found/plan.md`

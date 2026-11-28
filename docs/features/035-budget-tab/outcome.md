# Outcome: Budget tab: set up a month

Brief: ./brief.md · Finished 2026-10-17

## PRs

- [#46](https://github.com/dimuch/kopiyka/pull/46) Budget tab: set up a month — before versioning

## Decided

- Gate A: the Expenses tab's "Go to Budget" link is hidden for an ended month with no budget.
- Review (user): an ended month with no budget says "September had no budget, so it can't take expenses." in the
  form; current and later months keep "Set up ...'s budget first.".
- Home's Budget card opens the current month, even when the tab was left on another one.
- The empty list is the "no budget" signal, with no new API code.

## Left out

- Planned amounts, row taps and editors (036), rename (037), add (038) and progress (034).
- Keeping the Budget tab's month anywhere but the route param, or in step with the Expenses tab.
- The light theme wasn't checked visually; the new parts use theme tokens only.

## Follow-ups

- Inline `copyRefusedText` if the PR needed cutting — dropped: it shipped as planned.
- Conventions §3 "nothing carries over" — dropped: §3 already says each month has its own list.
- `MONTH_RE` accepts `9999-12` — in BACKLOG.md

Full plan: `git show 6c7754b2:docs/features/035-budget-tab/plan.md`

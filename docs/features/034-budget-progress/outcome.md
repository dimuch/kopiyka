# Outcome: Budget progress on the Expenses tab and Home

Brief: ./brief.md · Finished 2026-10-21

## PRs

- [#52](https://github.com/dimuch/kopiyka/pull/52) Budget progress on the Expenses tab and Home — before versioning

## Decided

- The Expenses tab's summary card shows the planned total in its existing Budget slot, since 027 removed the compact
  header total.
- Copy: "€86.20 of €120" by the name, "€12.40 over" under the bar, "Not set" for a month with no budget.
- The warning starts at exactly 90% of planned, with no rounding; spent equal to planned warns but isn't over.
- Deviation: the row amount doesn't shrink, so a long name truncates and the amount stays on one line.
- Consolidate left `budgetProgress`, `plannedCents` and the two screens' budget figure as they were.

## Left out

- Any API change, including a server-side spent total.
- Over-budget colours on the card, a "left to spend" figure, and progress on the Category screen or Statistics.
- Notifications at 90% or 100%.

## Follow-ups

- `CompactTotal`'s JSDoc says "the budget part appears once budgets exist", but its only caller passes `null` — in
  BACKLOG.md

Full plan: `git show 20abcc06:docs/features/034-budget-progress/plan.md`

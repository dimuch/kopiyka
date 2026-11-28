# Outcome: Expenses summary: the same figure order as Budget

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#179](https://github.com/dimuch/kopiyka/pull/179) Expenses summary: the same figure order as Budget — v1.24.1

## Decided

- The Expenses card's figures were swapped to Spent, Budgeted, Remaining, the same order as Budget: Budgeted centred,
  Remaining on the right with the danger colour when over plan. The index-based alignment styles stayed.
- `spendingFigures`' screen reader label follows the new order (`Spent …, budgeted …, remaining …`); its signature
  stayed. The test's expected labels were changed first, so they failed before the fix.
- The no-categories card and its label were left as they were.

## Left out

- One shared summary-card component for both tabs: out of the brief's scope. The three-figure row was later shared
  in 133 (#205).
- Renaming the figures, any Budget tab change, and edits to brief 107's historical docs.

## Follow-ups

- Move 112 out of "Planned: small fixes" in BACKLOG.md — done in 111 (BACKLOG.md now lists 112 as finished)

Full plan: `git show ac5a1036:docs/features/112-summary-figures-order/plan.md`

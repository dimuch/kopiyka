# Outcome: Edit, delete and copy income

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#81](https://github.com/dimuch/kopiyka/pull/81) Edit, delete and copy income, and an Income card on Home — before versioning

## Decided

- Built from 059's slices 6–8: tap an item to edit it, delete it from its form, and copy last month's income on an
  empty Income tab. Home gained an Income card first in its grid.
- Return in either field submits the form, as `planned-amount.tsx` and a web form do.
- Deleting is immediate with no confirm or Undo, because the API hard-deletes.
- In the build, Save and Delete share one `run(action, failed)` in `IncomeForm` instead of two copies.
- Some checks moved: "no Copy in October" ran on September, and "Not set" ran with a stubbed request. Light mode and a
  first-load failure were not seen.

## Left out

- Anything of 060's (the rule, its message, the Budget figures).
- A GET-one route, Undo or soft delete for income.
- A shared copy-flow hook or `closeTo(tab, month)`, left for a third caller.

## Follow-ups

- One copy flow for Budget and Income — done in 129, #201
- One modal header — done in 128, #200
- One "close to tab" helper — done in 125, #197
- Fold `incomeCents`, `sumCents` and `plannedCents` — in BACKLOG.md

Full plan: `git show b4a4ae6a:docs/features/061-income-edit-copy/plan.md`

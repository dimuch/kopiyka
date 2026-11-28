# Outcome: Income tab

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#78](https://github.com/dimuch/kopiyka/pull/78) Income tab: list and add income — before versioning

## Decided

- The user split the brief: 059 built the tab, month switcher, items, total and add form; edit, delete and copy moved
  to brief 061. Ship order became 059, then 061, then 060.
- 058's 2a/2b cut was not used, because a tab that could only list and copy would always be empty.
- The add form (~190 lines) shipped with its caller in one slice, as earlier modals did.
- The plan's 3 unticked boxes (edit, delete, copy) were built in 061 (#81).
- Light mode was not seen on web, and Cancel during a save was not checked on a slow network.

## Left out

- Any API change, the rule and the Budget figures (060's).
- Undo or a confirm for deleting; income on Home, Statistics or Budget.
- The month carrying over between tabs; sorting or grouping items.

## Follow-ups

- One copy flow for Budget and Income — done in 129, #201
- Move or rename `normalizeName` if a third non-category caller appears — dropped: no third caller came.
- One modal header for the six modals — done in 128, #200
- One "go back, or replace with a tab" helper — done in 125, #197
- Submit the income form on Return — done in 061, #81
- Fold `incomeCents`, `sumCents` and `plannedCents` into one helper — in BACKLOG.md

Full plan: `git show e9ca9d41:docs/features/059-income-tab/plan.md`

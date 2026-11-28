# Outcome: One Back-with-fallback for the app's modals

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#197](https://github.com/dimuch/kopiyka/pull/197) One Back-with-fallback for the app's modals — v1.26.11

## Decided

- Roadmap row R9. `closeToBudget.ts` exports `backOr(fallback)`, now the only caller of `router.canGoBack()`;
  `closeToBudget` uses it.
- Members, the expense form, the category screen and delete-category dropped their own back helper and call
  `backOr('<path>')`. Income-item kept a local `leave(month)`, since its fallback is built from the month.
- The "opened straight from a web link" reason lives once in `backOr`'s JSDoc. `closeToBudget`'s and income-item's
  `leave` JSDocs kept their own reason, and the category screen kept a one-line comment on why its fallback is
  Expenses, as the skeptic suggested.
- The web check ran in dark only: no style changed.

## Left out

- Renaming or moving `closeToBudget.ts`, and a `closeToIncome` twin for income-item's one caller.
- Tests for `backOr` (navigation only) and the `router.dismissTo` uses, which aren't the back rule.

## Follow-ups

- `closeToBudget.ts` now also holds the general `backOr`; it could be renamed, such as to `backOr.ts` — in BACKLOG.md

Full plan: `git show 25a348bb:docs/features/125-app-back-fallback/plan.md`

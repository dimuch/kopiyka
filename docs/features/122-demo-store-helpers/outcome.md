# Outcome: Name the demo store's repeated lookups and sums

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#194](https://github.com/dimuch/kopiyka/pull/194) Name the demo store's repeated lookups and sums — v1.26.8

## Decided

- Roadmap row R6, all in `apps/mobile/src/demo`. A characterization test first pinned the 404 for an edit or remove
  of a removed category row.
- One change per commit: `monthRow` (taking a `removed` boolean, as the brief fixed), `liveExpensesIn`, reuse of
  `sumCents` and `incomeCents`, `reuseOrCreate`, and a named comparator.
- The comparator is `byRank`, not `rankNames` as the brief said: `rankNames` already names the function that holds
  it. The suggestion type is `NameSuggestion`, not `Suggestion`, to say what it holds.
- The POST's own row lookup was left as it was: the brief names three places.

## Left out

- Using `monthRow` for the POST's lookup, or rewriting `inMonth` with it.
- The names route's two-month filter and `incomeLimit.ts`'s planned sum.

## Follow-ups

- The demo never checks `expenseDate`'s shape, unlike the API's Zod; only the app's well-formed input keeps its month
  filters right. A note, not a bug the app can hit — in BACKLOG.md

Full plan: `git show 6c05629d:docs/features/122-demo-store-helpers/plan.md`

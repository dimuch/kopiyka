# Outcome: Named comparators and one shared month schema in the API

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#192](https://github.com/dimuch/kopiyka/pull/192) Named comparators and one shared month schema in the API — v1.26.6

## Decided

- Roadmap row R4. `compareCents` kept its name and became three plain `if`s; `nameSuggestions.ts` got a local
  `compareText` of the same shape. Both stay on `<`/`>`, so strings still sort by code unit, as a new test pins.
- `monthChecks.ts` exports one `MonthParams`. Categories' own category-and-month params were renamed
  `CategoryMonthParams` first, then categories, income and balances took the shared schema.
- Categories' `?month=` query parses with a schema named `MonthParams`, accepted so the sharing stays visible.
- Two comparators instead of one generic one: two callers in two domains.
- Rebased after R3 (#191) merged; the backlog slice marked R3 done instead of R2.

## Left out

- A shared generic comparator, or moving `compareCents` to `money.ts`.
- Expenses' and the summary's query schemas, which only look alike, and bad-month tests for routes that parse with
  schemas already tested.

## Follow-ups

None.

Full plan: `git show 2178106a:docs/features/120-api-small-structure/plan.md`

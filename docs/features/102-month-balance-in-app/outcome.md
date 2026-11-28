# Outcome: Work out each month's start and end balance in the app

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#144](https://github.com/dimuch/kopiyka/pull/144) Work out each month's start and end balance in the app — v1.17.0
- [#152](https://github.com/dimuch/kopiyka/pull/152) Set a month's actual End in the API — v1.21.0
- [#153](https://github.com/dimuch/kopiyka/pull/153) Work out month balances in the demo — v1.22.0
- [#155](https://github.com/dimuch/kopiyka/pull/155) Set a month's actual End from the Budget tab — v1.23.0

## Decided

- After the last imported month, a month starts at the previous End and ends at that Start plus income minus spent.
  The line starts at the earlier of the first budgeted and the first imported month; imported months keep their Start.
- A month's End can be set by hand (`month_actual_ends`); the next month starts from it, and clearing it brings back
  the worked-out End. The line reads `Start −€35 → End €120 (actual)`, and the refusal code is `no_balance`.
- Four PRs, each under ~400 lines; the demo PR counts as minor, since the live demo gains a visible line.
- In the build, the Budget tab reloads the balance when an Undo restores a category, keyed without the version so the
  line doesn't blank while it refetches. Other briefs took 1.17.x–1.20.1 before PRs 2–4.

## Left out

- A cache of computed balances, a `calculatedEur` or `source` field, and who/when columns.
- Editing Start, and balances on Home, Statistics or the MCP connector.
- Recomputing January–October, and Android keyboard handling.

## Follow-ups

- One modal-form kit for `income-item.tsx`, `category-form.tsx` and `actual-end.tsx` — done in 128, #200.
- Migration 016's stale "Nothing in the app reads it yet" — dropped: migrations aren't edited after merge.
- Balance and Statistics reads span several queries without a transaction — in BACKLOG.md

Full plan: `git show 904351f2:docs/features/102-month-balance-in-app/plan.md`

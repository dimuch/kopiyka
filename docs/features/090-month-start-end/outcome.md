# Outcome: Show a month's start and end balance on the Budget tab

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#127](https://github.com/dimuch/kopiyka/pull/127) Show a month's start and end balance on the Budget tab — v1.9.0

## Decided

- One line under the month switcher, such as `Start −€180 → End −€52`, from brief 085's imported balances; the user
  chose `eur` as it is, with no `.00` on whole euros.
- The route answers `{ balance: { openingEur, closingEur } | null }`, so a month without balances is a plain 200.
- A failed load leaves the line out, with no retry or error text; a failed refetch keeps the line already shown.
- The folder was renumbered from 089 to 090, as another brief already had 089.
- The browser check ran on a QA ledger holding a copy of the real ledger's ten rows.

## Left out

- A write route, and balances on Home, Statistics or the MCP connector.
- Worked-out balances from November on (brief 102 added them), and sample balances in the demo.

## Follow-ups

- The brief number clash with 089 — done (renumbered to 090 before either landed).
- July and August both hold `0.00 → -377.00` in the laptop data — in BACKLOG.md
- One shared month schema for the four route files — done in 096, #138 (one month field; local schemas kept).

Full plan: `git show 379c3f1e:docs/features/090-month-start-end/plan.md`

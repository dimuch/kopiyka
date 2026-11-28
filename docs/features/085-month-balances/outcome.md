# Outcome: Import each month's opening and closing balance from Notion

Brief: ./brief.md · Finished 2026-11-08

## PRs

- [#114](https://github.com/dimuch/kopiyka/pull/114) Import month balances from Notion: building blocks — v1.5.0
- [#116](https://github.com/dimuch/kopiyka/pull/116) Import month balances from Notion — v1.6.0

## Decided

- A `month_balances` table with signed EUR amounts that are never NULL: the brief's fill rule always sets both sides,
  and the dry run prints a note on where each filled value came from (Gate A).
- `yarn api import-balances` took the history importer's three modes (`--save`, dry run, `--apply`), plus a
  `--month` flag for the January-first run, since a January-only snapshot would have made up nine months.
- Two PRs, not stacked: building blocks first, then the import, built from `main` after the first merged.
- July and August were left as Notion has them (0 → −377 each), with one continuity warning.
- `toCents` learned a leading `-`, and `totals.ts`' private `signedCents` went in favour of it.

## Left out

- An API route, DTO or app change (brief 090 showed the balances), and any write to Notion.
- A shared CLI module for the importers: two copies didn't meet the rule of three.

## Follow-ups

- Share the importers' flag parsing and snapshot file I/O — done in 098, #140.
- Run the import in production after the deploy — done (laptop and production, January–October, 2026-11-21).

Full plan: `git show 2406cb07:docs/features/085-month-balances/plan.md`

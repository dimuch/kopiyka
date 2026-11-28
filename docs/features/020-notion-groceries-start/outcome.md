# Outcome: Notion sync, part 1: record the groceries already in Notion

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#28](https://github.com/dimuch/kopiyka/pull/28) Notion groceries starting point — before versioning

## Decided

- At Gate A the Notion brief (about 1,900 lines) was split into five sequential briefs, each its own PR: 020 starting
  point, 021 groceries sync, 022 category totals, 023 missing rows, 024 the button.
- No Notion calls yet. `GET …/notion/status` counts the groceries whose Notion row has to be created, updated or
  trashed, and answers 404 `notion_not_configured` for no config or another ledger.
- `yarn api notion-start --adopt` recorded the 11 hand-copied October groceries in one transaction, refusing the whole
  batch on any bad id. The Kopiyka ID column was filled in by hand in Notion.
- Gate A: the totals starting point waited for 022.
- Review: the loader reads only records sent in the synced year, and `--adopt` refuses an empty list.

## Left out

- The Notion client, trash state and last-sync time (021), totals (022) and the app (024).
- An HTTP endpoint for adoption, and checking page ids against Notion.

## Follow-ups

- Notion's "May" view filtered on June — dropped: a Notion-side fix, and the sync was removed in 109 (#158, #159)

Full plan: `git show 2a9545f2:docs/features/020-notion-groceries-start/plan.md`

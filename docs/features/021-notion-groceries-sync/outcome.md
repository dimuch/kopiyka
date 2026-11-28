# Outcome: Notion sync, part 2: send groceries to the Notion Groceries table

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#29](https://github.com/dimuch/kopiyka/pull/29) Sync groceries to Notion — before versioning

## Decided

- One PR (about 605 lines planned) rather than a split, so the real-Notion check landed with the code it checks.
- Gate A: no transaction across Notion and MySQL, and no revert. Each grocery is recorded right after Notion accepts
  it, failures stay unsent for the next run, and `last_synced_at` is written only when nothing failed.
- A small `fetch` client (`Notion-Version: 2026-03-11`, no SDK) spaced to the rate limit and honouring
  `Retry-After`, with one in-process lock per ledger. A restore takes two calls.
- The real check showed Notion refuses to trash a page already in trash, so the client checks `isInTrash` first.
- Review: a create refuses a grocery still live in another year's table, and the sync time is taken before the run.

## Left out

- A Notion-to-kopiyka sync, reading edits made in Notion, background jobs and a cross-process lock.
- Totals and the Expenses table (022, 023) and the app (024).

## Follow-ups

- A restore fails once Notion has purged a trashed page — dropped: the Notion sync was removed in 109 (#158, #159)
- A create that landed but wasn't recorded stays live after a delete — dropped: the sync was removed in 109

Full plan: `git show ac5a4cbd:docs/features/021-notion-groceries-sync/plan.md`

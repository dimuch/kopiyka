# Outcome: Import the 2026 budget history from Notion

Brief: ./brief.md · Finished 2026-10-30

## PRs

- [#63](https://github.com/dimuch/kopiyka/pull/63) Import the 2026 budget history from Notion — before versioning

## Decided

- A CLI, `yarn api import-history`, with a saved snapshot, a dry run and `--apply`, one transaction per month, for
  January-October 2026.
- Each category-month becomes its planned amount plus one `Total` expense; existing expenses there are replaced.
- Notion names match a live category by tech name, as the totals sync does; two rows for one category in a month
  stop the run before it writes.
- Imported `Total`s were marked as counted, so the Notion sync left them alone; no new marker table.
- Gate A: one PR, not three; the runbook's laptop steps were rewritten for an account-only production start.
- The laptop import ran from a snapshot read through the Notion connector, since the token answered 401.

## Left out

- An HTTP route, button or schedule, and any write to Notion.
- A month filter, a year flag, or undoing an import: re-running replaces a month.

## Follow-ups

- Accent-only name differences fail at `--apply` instead of the dry run — dropped: the importer was removed in 109,
  #159.
- `deploy/README.md` still described `NOTION_*` in production — done in 049, #63 (Gate A)
- After an import, the quick row ties on the import time — done in 099, #141 (the row follows the member's order)

Full plan: `git show 593f8dc4:docs/features/049-notion-history-import/plan.md`

# Outcome: Remove the Notion sync and import code

Brief: ./brief.md · Finished 2026-11-25

## PRs

- [#158](https://github.com/dimuch/kopiyka/pull/158) Remove the Sync to Notion panel from Home — v1.23.2
- [#159](https://github.com/dimuch/kopiyka/pull/159) Remove the Notion sync, importers and settings — v1.23.3

## Decided

- Two patch PRs, app first (user, 2026-11-24). The brief's "plain 404" premise was wrong: a removed route would have
  shown "Couldn't check Notion sync." on web tabs still running an older build.
- #158 took the Home panel out with the API unchanged. #159 removed the sync routes, `notion-start`, the three
  importers, the nine `NOTION_*` settings, their tests and the docs.
- #159 was branched minutes after #158's deploy instead of a day later; the day's wait moved to its deploy.
- All imported data, migrations and the four `notion_*` tables stayed.

## Left out

- A stub route still answering `notion_not_configured`.
- Dropping the `notion_*` tables or touching migrations 004–006.
- Rewording history comments that are still true, and editing older briefs or plans.

## Follow-ups

- Revoke the Notion integration and delete the laptop's `NOTION_*` keys — in BACKLOG.md
- Drop the four `notion_*` tables once the release has run fine — in BACKLOG.md
- Leave `NotionSyncPanel` out of the 104 parts — done in 104b, #160 (the panel was already gone).

Full plan: `git show 60bc3571:docs/features/109-remove-notion/plan.md`

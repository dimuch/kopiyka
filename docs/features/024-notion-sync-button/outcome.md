# Outcome: Notion sync, part 5: "Sync to Notion" button on Home

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#34](https://github.com/dimuch/kopiyka/pull/34) Sync to Notion button on Home — before versioning

## Decided

- A Notion panel under Home's cards: "N new · not synced yet" or "Up to date", a Sync to Notion button, and the run's
  result with up to 5 reason lines.
- Gate A: when the status can't be loaded, Home shows "Couldn't check Notion sync." with Retry for every ledger.
  `notion_not_configured` hides the panel, and it stays hidden while Home is mounted.
- Times are in Kyiv time. A ref guard stops a fast double tap, and Retry is disabled while syncing.
- One PR at about 470 lines, over half of it tests. Review gave Retry a 44pt target and put `role="alert"` on the
  result's text lines.

## Left out

- Any API, migration or env change, and automatic or on-focus syncs.
- Category display names in the reasons, and a scrolling Home.

## Follow-ups

- The production proxy timeout for long syncs — dropped: the Notion sync was removed in 109 (#158, #159)

Full plan: `git show cf276f6c:docs/features/024-notion-sync-button/plan.md`

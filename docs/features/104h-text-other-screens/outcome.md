# Outcome: Shared components, part 8: Text on the remaining screens

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#171](https://github.com/dimuch/kopiyka/pull/171) Shared components, part 8: Text on the remaining screens — v1.23.11

## Decided

- At Gate A: one PR in two slices (about 220 lines) for the 50 sites in 8 files, with no new variant.
- These screens have no state switches, and no text changes while saving, so there were no busy views;
  `expense-added` and four extra views were checked instead.
- All 23 views matched in both themes. The final search found role spreads and `fontFamily` only in the listed
  exceptions, which completed brief 104's text work.

## Left out

- 105's look and the two weight inconsistencies (left for 105b).
- TextInput styles and TabBar (briefs 105 and 106).
- Seeding a second ledger or an ended month for extra views.

## Follow-ups

- A lint guard against `text` role spreads and `fontFamily` outside `Text.tsx` and `theme.ts` — in BACKLOG.md
- A conventions §5 line saying text goes through `Text` and pointing at the 104 components — in BACKLOG.md

Full plan: `git show 97b72a58:docs/features/104h-text-other-screens/plan.md`

# Outcome: Flush chip tile

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#184](https://github.com/dimuch/kopiyka/pull/184) Inset the chip's category tile 3pt — v1.26.1

## Decided

- The plan's two slices (the version bump and the chip padding) were built in #184; their boxes were never ticked.
- The chip was first built with the tile flush with the pill's left end. After review the user changed it to a 3pt
  inset on both sides, so the 26pt tile sits concentric with the pill's round end: an `inset` style, with a lint
  disable since there is no 3pt token. The brief's criteria were updated to match.
- Chips without a leading tile or icon, such as the date chips, kept 8pt on both sides.
- The "N more" icon counts by its box, not its drawn dot, which sits inside the glyph's own margin.

## Left out

- A prop to choose the inset: there is one chip look.
- A unit test (a style value) and any change to the tile, the chip's height, colours or touch area.
- An edit to the design-system doc: its `Chip` row says nothing about padding.

## Follow-ups

None.

Full plan: `git show 219e4deb:docs/features/115-flush-chip-tile/plan.md`

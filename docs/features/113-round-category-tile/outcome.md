# Outcome: Round category tile

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#181](https://github.com/dimuch/kopiyka/pull/181) Round category tile — v1.24.2

## Decided

- `CategoryTile` uses `radius.pill` instead of `size * 0.3`, so every tile (26, 28, 40 and 52pt) is a circle. This
  replaced the brief's `size / 2`: it draws the same circle, is how the repo already makes circles, and drops a lint
  disable.
- The design-system doc moved the category tile from the `sm 10` radius to `pill`.
- The chip's tile is concentric in radius only: its centre sits 5pt in from the pill's round end because of the
  chip's 8pt left padding. Accepted at plan approval; brief 115 later inset the chip.

## Left out

- Icons instead of letters (brief 114) and any change to `Chip`.
- A `shape` prop or a square option: there is one tile shape.
- A unit test: it is one style value, and conventions §6 rules out snapshot tests.

## Follow-ups

None.

Full plan: `git show 569f7655:docs/features/113-round-category-tile/plan.md`

# One three-figure row for Budget and Expenses

Type: chore

## Why

Roadmap row R17 (`docs/features/refactor-roadmap-2026-11.md`). Budget's `IncomeFigures` card and the Expenses tab's
summary card each draw the same row of three labelled figures (label above, amount below, the middle one centred, the
last one right-aligned, a negative one in the danger colour), and their styles are copied line for line
(`budget.tsx` `figure`/`figureCentre`/`figureEnd` = `expenses.tsx`'s).

## What

A `FigureRow` component in `components/` that draws the three figures (and owns their styles); `IncomeFigures` and the
Expenses card use it. Each keeps its own card, labels, values and accessibility label.

## Acceptance criteria

- [ ] `components/FigureRow.tsx` exists; Budget's `IncomeFigures` and the Expenses card use it and no longer declare
      the figure styles themselves
- [ ] The two cards render exactly as before (layout, colours, the danger colour for a negative figure, accessibility)
- [ ] Layout records of both cards before and after are identical, light and dark, at 390×844
- [ ] `demo-modules.txt` changes only by the new module (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; Statistics' totals card (a different layout).

## Notes

Covered by: no tests (UI); layout records of both cards. Base: R16's branch (`chore/load-state`, in review), rebased on
`origin/main` once it merges. Baseline: API 549 passed + 2 skipped, MCP 329, app 547. R16 takes 1.26.18, so this PR is
1.26.19. This is the last roadmap row: after it merges, `main` is deployed.

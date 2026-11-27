# Statistics in named sections

Type: chore

## Why

Roadmap row R15 (`docs/features/refactor-roadmap-2026-11.md`). The Statistics screen's render in
`apps/mobile/src/app/(tabs)/statistics.tsx:34-192` nests seven levels deep: the totals card, the per-category rows and
the per-month rows are all inline in one JSX block, so a reader has to keep the whole tree in mind to change any part.

## What

Extract in-file `TotalsCard`, `CategoryRows` and `MonthRows` components for those three blocks. The screen's render
then reads as its sections. Logic already in `data/periodSummary.ts` and `data/period.ts` stays there.

## Acceptance criteria

- [ ] `statistics.tsx` has in-file `TotalsCard`, `CategoryRows` and `MonthRows`; the screen's render is ≤ 4 element levels deep (fragments not counted; 6 today)
- [ ] What each period shows (totals, category rows, month rows, empty and error states) is unchanged
- [ ] Web check at 390×844, light and dark, for every period choice (a month, a range, the year…)
- [ ] `demo-modules.txt` unchanged; `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified (periodSummary, period tests)
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; the load/error/refresh triad (R16) and the period menu.

## Notes

Covered by: periodSummary, period tests (logic); web check of every period. Base `origin/main` after R12 (#200): gates
green, API 549 passed + 2 skipped, MCP 329, app 531. R13 (#201) takes 1.26.15 and R14 (brief 130) 1.26.16, so this PR
is 1.26.17 (re-bumped on rebase if needed).

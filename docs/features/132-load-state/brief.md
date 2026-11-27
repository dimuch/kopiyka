# One load state for the data screens

Type: chore

## Why

Roadmap row R16 (`docs/features/refactor-roadmap-2026-11.md`). Six screens write the same three-way render by hand:
a spinner while there's no data yet, a `LoadError` with Retry when the first load failed, and the data with a
"Couldn't refresh" line above it when a later reload failed: Budget, Expenses, Income, Statistics, a category screen
and Members. Each copy differs only in its spinner style, margins and the first-load error text.

## What

- A `<LoadState data error onRetry loadMessage spinnerStyle>{(data) => …}</LoadState>` component in `components/`
  that renders the three states and passes the loaded data to its children.
- The six screens use it; spinner styles, margins and messages pass through unchanged.

## Acceptance criteria

- [ ] `components/LoadState.tsx` exists; Budget, Expenses, Income, Statistics and Members use it for their loading /
      first-load error / refresh-error render. The category screen keeps its own: its refresh line sits inside its
      scroll view and its not-in-month branch has none, so LoadState would move it (reshaped at planning)
- [ ] Each screen's spinner (colour, style, margins), first-load error text and "Couldn't refresh" line are unchanged,
      and so is what renders around them
- [ ] Web check at 390×844, light and dark: loading, first-load error and refresh error on the five screens
- [ ] `demo-modules.txt` changes only by the new module (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed texts; `LoadError` itself; the figure rows (R17).

## Notes

Covered by: no tests (UI); web check of loading, error and refresh-error states on five screens. Base: `origin/main` after R15 (#203). Baseline: API 549 passed + 2 skipped, MCP 329, app 531 (547 once R14 #202 merges). R15 takes 1.26.17, so this
PR is 1.26.18.

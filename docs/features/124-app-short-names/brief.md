# Descriptive names across the app

Type: chore

## Why

Roadmap row R8 (`docs/features/refactor-roadmap-2026-11.md`). `find-short-names.sh apps/mobile/src` reports 58 lines
with single-letter names in `src/app` (category/[categoryId] `c d e`, budget `m`, expenses `s r`, expense `v c cat`,
income-item `set`), `src/components` (CategorySheet, CategoryPicker, AppearancePicker, DateChips, Icon,
CollapsingSummary), `src/data` (monthSummary, quick, categoryRemove, undo, useRate, useExpenseNames, `(v) => v + 1`),
`format.ts`, `theme.ts:133` and `auth/ledgerChoice.ts:11`. Readers have to decode them before they can read the line.
`NameCombobox.tsx:87-97` also picks the scroll offset with a nested ternary that hides what it decides.

## What

- First, in its own commit: a pure `scrollToShow(index, scrollY, rowHeight, visibleRows)` in `data/nameSuggestions.ts`
  for `NameCombobox.tsx`'s nested ternary, with characterization tests.
- Then rename, following `kopiyka-refactoring` §4, one commit per area (screens, components, data, format/theme/auth).
  Renames only: no logic change in a rename commit.

## Acceptance criteria

- [ ] `data/nameSuggestions.ts` exports a pure `scrollToShow`, unit-tested; `NameCombobox.tsx` calls it and has no
      nested ternary
- [ ] `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh apps/mobile/src` reports no lines outside
      `components/categoryIcons.LICENSE.txt` (licence text, which can't be renamed)
- [ ] Rename commits are renames only, one per area
- [ ] `demo-modules.txt` unchanged; `yarn mobile check-builds` passes
- [ ] Web check at 390×844, light and dark, of the screens whose code was renamed (no visible change)
- [ ] Behaviour unchanged: existing tests pass unmodified (a mechanical rename of an imported symbol is allowed)
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; structural changes beyond `scrollToShow` (R9–R17 do those).
- Vague multi-letter names (`data`, `item`); `apps/api`, `apps/mcp`.

## Notes

Covered by: format, quick, monthSummary, categoryRemove, ledgerChoice, theme, nameSuggestions tests; UI renames by web
check. Base: `origin/main` after R7 (#195). Baseline
after R6: API 549 passed + 2 skipped, MCP 329, app 511. R7 takes 1.26.9, so this PR is 1.26.10.

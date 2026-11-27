# Announced errors in one hook and one line component

Type: chore

## Why

Roadmap row R11 (`docs/features/refactor-roadmap-2026-11.md`). Screens show an error by setting it and announcing it
to VoiceOver in the same two lines (`setError(text)` + `AccessibilityInfo.announceForAccessibility(text)`), repeated in
`CategoryForm.tsx:62`, `actual-end.tsx:94`, `income-item.tsx:154`, `delete-category.tsx:118`, `expense.tsx:182`,
`members.tsx` (×4) and inline in budget, income and settings. The error itself is then drawn by ~12 copies of the same
danger-coloured `<Text accessibilityRole="alert">` block.

## What

- `useAnnouncedError()` → `{ error, showError, clearError }` in `data/` (or where conventions §2 puts a UI hook), used
  where a screen sets and announces an error.
- An `<ErrorLine text>` component in `components/` for the danger-label `accessibilityRole="alert"` blocks whose shape
  is the same.
- No generic busy/action hook: the flows differ on purpose (some keep `busy` after success, CategoryForm's busy is its
  parent's, members handles `gone`).

## Acceptance criteria

- [ ] `useAnnouncedError` exists and the listed set-and-announce pairs use it; the announced text and when it is
      announced are unchanged
- [ ] `<ErrorLine text>` exists and the same-shaped alert blocks use it; each keeps its role, colour, variant and
      margins (pass-through where a block differs, or leave that block as it is and say why)
- [ ] Each screen's `busy` / success / `gone` flow is untouched
- [ ] Web check at 390×844, light and dark, of each error shown (same text, same place); a note for the user to check
      VoiceOver on iPhone
- [ ] `demo-modules.txt` changes only by the intended new modules (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed error texts; a busy/action hook; `LoadError` (R16 owns the load-error triad).

## Notes

Covered by: no tests (UI); web check of each error. Base: `origin/main` after R10 (#198). Baseline after R9: API 549 passed + 2 skipped, MCP 329, app 531. R10 takes 1.26.12, so
this PR is 1.26.13.

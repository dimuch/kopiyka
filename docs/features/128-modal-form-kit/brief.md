# One modal-form screen frame

Type: chore

## Why

Roadmap row R12 (`docs/features/refactor-roadmap-2026-11.md`; also the 102 follow-up "one modal-form kit" in
`BACKLOG.md`). `income-item.tsx`, `actual-end.tsx` and `category-form.tsx` each build the same frame by hand: a
`SafeAreaView` with top and bottom edges, `Stack.Screen gestureEnabled={!busy}` so a save can't be swiped away, a
`ScreenHeader` whose Back is disabled while busy, and the "That link isn't valid." body for a bad link. Two of them also
declare the same `Saving` props type.

## What

- A `ModalFormScreen` component in `components/` that renders that frame around its children (header title, Back
  action, busy, and whether the link is valid).
- One shared `Saving` type (`busy`, `setBusy`) used by the three screens.
- Each screen keeps its own `run` and error mapping.

## Acceptance criteria

- [ ] `components/ModalFormScreen.tsx` exists; the three screens use it instead of their own frame
- [ ] One exported `Saving` type replaces the per-screen copies
- [ ] Each screen's header title, Back target, busy lock, swipe-back lock and invalid-link body are unchanged
- [ ] Web check at 390×844, light and dark, of the three forms (valid and invalid link, Back while saving); a note for
      the user to check the iOS swipe-back lock
- [ ] `demo-modules.txt` changes only by the new module (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; the forms' fields, `run`, error mapping; `CategoryForm` beyond its screen frame.

## Notes

Covered by: no tests (UI); web check of the three forms; iOS swipe-back lock for the user. Base: `origin/main` after R11
(#199). Baseline after R10: API 549 passed

- 2 skipped, MCP 329, app 531. R11 takes 1.26.13, so this PR is 1.26.14.

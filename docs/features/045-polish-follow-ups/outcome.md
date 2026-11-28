# Outcome: Polish after removing via the rename screen

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#59](https://github.com/dimuch/kopiyka/pull/59) Polish after removing via the rename screen — before versioning

## Decided

- A category removal's Undo refused with `month_ended` says "{Month} has ended, so it can't be restored." through
  `restoreRefusedText`, as the expense form does.
- `dangerText(colors)` in `theme.ts` replaced three copies of the danger text style.
- A `usePushOnce()` hook guards rename's Remove, the Budget row's pencil and the Category menu's Remove until the
  screen regains focus; a time window and expo-router's `dangerouslySingular` were rejected.
- The web checks ran in a sibling worktree, since Metro under `.claude/worktrees/` served Expo's welcome page.

## Left out

- Guarding the other pushes: each is a one-line swap to `usePushOnce` later.
- A `DangerText` component, or sharing the 48pt button styles.
- A text for a restore refused with `not_found`: it needed wording, so it got its own brief.

## Follow-ups

- A category restore refused with `not_found` offers a Retry that can't work — done in 046, #60

Full plan: `git show f8f14359:docs/features/045-polish-follow-ups/plan.md`

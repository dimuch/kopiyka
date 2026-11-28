# Outcome: Shared components, part 3: outlined and text buttons through Button

Brief: ./brief.md · Finished 2026-11-25

## PRs

- [#161](https://github.com/dimuch/kopiyka/pull/161) Shared components, part 3: outlined and text buttons through Button — v1.23.4

## Decided

- At Gate A: one PR of about 279 lines, with four new `variant` values (`outlinedDanger`, `dangerText`, `mutedText`,
  `accentText`) instead of `variant` plus `tone`.
- Heights mapped onto the existing `medium` (48) and `compact` (44) sizes; differing padding stayed in each caller.
- `outlinedDangerButton`, `outlinedDangerText` and `dangerText` left `theme.ts`. The category menu row writes out the
  look itself, as it is a menu row, not a button.
- Disabled text buttons kept today's look (most don't dim), and text looks reset the corner to keep the focus ring.
- The only expected snapshot change was LoadFailed's Back text getting narrower; everything else matched.

## Left out

- Login's two links: `Link asChild` would need a second path through `Button`. UndoToast's Undo and DemoStrip stayed
  too.
- One disabled look, padding or height for text buttons: brief 105.

## Follow-ups

- Remove `bare`, the `filled && off` rule, Decline's 0.6, the padding overrides and `failedBack` — done in 105d, #176.
- Make LoadFailed's Back as wide as its word — dropped: 105d (#176) made it a centred, full-width text button.
- Revisit the exceptions (login's links, UndoToast's Undo, DemoStrip) — dropped: 105d and 105e (#176, #177) kept them
  as Pressables.

Full plan: `git show 56cd3402:docs/features/104c-text-buttons/plan.md`

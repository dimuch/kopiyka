# Outcome: Shared components, part 4: IconButton and Chip

Brief: ./brief.md · Finished 2026-11-25

## PRs

- [#163](https://github.com/dimuch/kopiyka/pull/163) Shared components, part 4: IconButton and Chip — v1.23.6

## Decided

- At Gate A: one PR of about 411 lines, slightly over the 400 guide, instead of splitting IconButton and Chip.
- `IconButton` takes a required `tone` (`muted` or `accent`), and `disabled` turns its icon `fainter`.
- `Chip` is a container like `Card`: it passes `Pressable`'s props through and adds `selected`.
- The category sheet's raised chips and the dashed "N more" stayed style overrides. Budget's pencil and the sheet's
  Close kept their square corner (`borderRadius: 0`), so nothing moved.
- All 9 views matched their before snapshots in both themes after every slice.

## Left out

- 105's look: round 44pt buttons, 32pt pills and shadows.
- Moving AppearancePicker, LedgerPicker, the period menu or NameCombobox's options onto `Chip`.

## Follow-ups

- Remove the square-corner overrides, DateChips' 16pt padding, the sheet's overrides and Chip's 48pt height — done in
  105d, #176.
- Decide whether AppearancePicker shares Chip's look — done in 105d, #176 (it draws Chip's pill as radios).

Full plan: `git show 60b18a65:docs/features/104d-icon-buttons-chips/plan.md`

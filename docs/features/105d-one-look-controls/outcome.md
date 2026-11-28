# Outcome: The fresh look, part 4: one look per control

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#176](https://github.com/dimuch/kopiyka/pull/176) The fresh look, part 4: one look per button, chip and icon button — v1.23.15

## Decided

- At Gate A, under the user's standing OK, the brief split in two: this part (buttons, chips, AppearancePicker, icon
  buttons), and 105e for the header, toast, inputs, menus and sheets.
- Filled buttons became one 48pt pill and text buttons a 44pt pill with 8pt sides. All dim to 0.4 when busy or
  disabled, with the spinner before the label. `ButtonSize`, `compact` and the one-off overrides went.
- The filled red `danger` went: destructive actions use the doc's grey with a red label. `accentText` became
  `accentLabel`.
- Chips are a 32pt pill in a 44pt touch area, with a 4pt tile gap so "education" fits. "N more" is a plain chip, and
  AppearancePicker draws the same pill as radios. Icon buttons are round.
- LoadFailed's Back became a centred, full-width text button. The review gave the pills `minHeight`, so large text
  grows them.

## Left out

- The doc's `secondary` look and IconButton's `raised` look: no caller.
- Login's links, Budget's balance line, Statistics' period button and UndoToast's Undo: Pressables, not Buttons.

## Follow-ups

- The category tiles' initials are under 4.5:1 on `fill` in light — in BACKLOG.md
- LedgerPicker's 20pt inset and the 20pt gutter against the doc's 16 — in BACKLOG.md
- The expense form's Back stays enabled while a save is in flight — in BACKLOG.md

Full plan: `git show 210d798b:docs/features/105d-one-look-controls/plan.md`

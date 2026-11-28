# Outcome: The fresh look: new palettes, Inter, cards and violet bars

Brief: ./brief.md · Finished 2026-11-26

## PRs

- [#173](https://github.com/dimuch/kopiyka/pull/173) The fresh look, part 1: palettes, violet bars, the caution label and the light default — v1.23.12

## Decided

- At Gate A the brief (about 1,000 lines) was split into parts, each its own brief, PR and patch bump: this one,
  then 105b (Inter), 105c (cards) and 105d (controls). 105d split again into 105d and 105e.
- This part shipped the design doc's light and dark palettes, violet → caution → danger bars, the "€X left" label on
  near rows and light as the default for anyone who never picked a theme.
- The category page kept its hero figure; placeholders moved from `faint` to `muted`, and the alerts to `danger`.
- The build put the row's words in `barNote(progress)` in `data/budgetProgress.ts`, with a table test.
- Statistics' "€30 under" reuses `BudgetProgress.leftCents` instead of its own sum.

## Left out

- `hairline` and the shadow tokens (no caller until 105c), and new values for the two border tokens.
- Telling a returning user who never picked a theme apart from a new install.
- Category tile hues, the tab bar (106) and Remaining's meaning (107).

## Follow-ups

- Rename Button's `accentText` look, which clashes with the new token — done in 105d, #176 (`accentLabel`).
- The expense form's Back stays enabled while a save is in flight — in BACKLOG.md

Full plan: `git show 1e6f6f5d:docs/features/105-fresh-look/plan.md`

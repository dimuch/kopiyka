# Outcome: Shared components, part 5: ScreenHeader

Brief: ./brief.md · Finished 2026-11-25

## PRs

- [#166](https://github.com/dimuch/kopiyka/pull/166) Shared components, part 5: ScreenHeader — v1.23.8

## Decided

- At Gate A: one PR of about 409 lines, with three variants (`modal`, `month`, `page`) for 11 header rows.
- Statistics' header stayed an exception, since a fourth variant would serve one caller.
- The five form titles gained a header role, the only intended change to the accessibility record.
- The `month` variant takes its action through a `trailing` slot, like `page`.
- `disabled` on `modal` is a state, not a look switch, so it stayed despite the "no boolean props" rule.
- Main moved twice during the build; Budget got a fresh baseline and the bump became 1.23.8.

## Left out

- 105's look: a round Back and one header shape.
- Disabling the expense form's Back during a save: a behaviour change.
- The modal-form kit: a later refactor.

## Follow-ups

- The expense form's Back stays enabled while a save is in flight — in BACKLOG.md
- For 105: the 52pt spacer, the modal's margin and HeaderDivider's side bleed — done in 105e, #177.

Full plan: `git show 137a9ebc:docs/features/104e-screen-header/plan.md`

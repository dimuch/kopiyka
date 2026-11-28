# Outcome: One filled text-field style

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#198](https://github.com/dimuch/kopiyka/pull/198) One filled text-field style — v1.26.12

## Decided

- Roadmap row R10. `components/TextField.tsx` exports `fieldStyle(colors)`, the filled look seven fields copied, and
  `symbolStyle`, the ₴/€ position. Each screen's `makeStyles` uses them, so styles still go through
  `StyleSheet.create`.
- `fieldStyle` includes the horizontal padding: AmountFields' style gained `paddingHorizontal` and lost its own
  `paddingRight`, with the same computed padding, as accepted at Gate A.
- The visual proof was a record of each field's position, size and computed style in 6 views, light and dark,
  instead of brief 104's full-page snapshot: all matched.

## Left out

- `DateField`'s field and other style twins (out of scope).
- A new `fieldStyles.ts` module, or `TextField` applying the style itself, which would change every caller's props.

## Follow-ups

None.

Full plan: `git show 26be4f05:docs/features/126-app-field-style/plan.md`

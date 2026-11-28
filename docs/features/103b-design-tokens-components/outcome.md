# Outcome: Put the shared components on design tokens

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#147](https://github.com/dimuch/kopiyka/pull/147) Put the shared components on design tokens — v1.17.3

## Decided

- The shared components (tab bar, month switcher, Home cards, the forms, the category sheet, the empty, error and
  Undo states, the pickers and the demo strip) take their spacing, radii, heights and type from the tokens.
- Gate A chose a 16pt `input` role with no line height, and accepted the Home card figure 20 → 22.
- The ledger picker and pending invites were checked from the diff only, with no before snapshot, as Gate A allowed.
- The month switcher's eyebrow tracking and the tab bar's 5pt padding are allowlisted; `CategoryInMonth`'s
  `spinnerMargin` moved to 103c with its caller.
- Gate B accepted the measured shifts (Home cards 4.5pt taller, month titles re-centred up to 3.5pt). The iPhone check
  was left for the user.

## Left out

- The 103c screens, shared `Card`/`Button`/`IconButton` (104), and colours, Inter and shadows (105).
- Tokens for icon and tile sizes, the toast's offsets and the divider's bleed.

## Follow-ups

- `DateField`'s hidden web date input keeps the browser's font size — done in 105b, #174.
- `CategoryInMonth`'s `spinnerMargin` on tokens — done in 103c, #149.

Full plan: `git show ae0e081a:docs/features/103b-design-tokens-components/plan.md`

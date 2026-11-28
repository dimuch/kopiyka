# Outcome: Put the remaining screens on design tokens

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#149](https://github.com/dimuch/kopiyka/pull/149) Put the category, expense and income screens on design tokens — v1.18.1

## Decided

- The category screen, add/edit and delete category, the expense form and the income item take their spacing, radii,
  heights and type from the tokens; every text field is 16px.
- Gate A split the brief: login, Members and no-ledger went to 103d with the lint list's removal.
- Gate A accepted the changes over 1pt: category total 32 → 28, delete question 24 → 22, delete warning 16/24 → 15/20.
- Login's code input and the category day labels' tracking stay allowlisted; amounts inside sentences get no tabular
  digits.
- In the build, the category screen's five inline styles became sheet entries with the same values. Gate B accepted
  the measured shifts (delete button 14pt higher, expense buttons 11.5–12.5pt lower); iPhone check left for the user.

## Left out

- `ScreenHeader` and `Button` components (104), and colours, Inter, shadows and borders (105).
- Roles for the code input or capitals labels, and tokens for the toast clearance or the 52pt login field.

## Follow-ups

- `amountLg` has one caller again, the category hero — dropped: 105 kept the hero, so the role is still used.
- `DateField`'s hidden web date input — done in 105b, #174.

Full plan: `git show 89d43f74:docs/features/103c-design-tokens-screens/plan.md`

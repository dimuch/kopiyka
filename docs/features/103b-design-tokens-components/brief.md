# Put the shared components on design tokens

Type: chore

## Why

Part 2 of brief 103, after the user split it into 103 / 103b / 103c at Gate A. Brief 103 (PR #145, v1.17.2)
added the `space`, `radius`, `size` and `text` tokens and moved the six tab screens onto them. But the shared
components those screens are built from still hard-code their numbers: 22 files in `src/components` and
`src/demo`, all still on the lint rule's `notOnTokensYet` list. Until they're on tokens too, the new look (brief 105) can't be a `theme.ts` change, because the tab bar, home cards, month switcher, forms and sheets would keep
their old values.

## What

Move these 22 files onto the tokens from `apps/mobile/src/theme.ts`, using the snapping rules in
`docs/features/103-design-tokens/plan.md` (Contracts → Snapping rules). Remove each file from `notOnTokensYet` in
`apps/mobile/eslint.config.js` as it moves.

| Where it shows             | Files                                                                   |
| -------------------------- | ----------------------------------------------------------------------- |
| Every tab                  | `TabBar`, `MonthSwitcher`, `HomeButton`, `AddExpenseButton`             |
| Home                       | `HomeCards`                                                             |
| Budget, Expenses           | `ReorderList`, `CollapsingSummary`, `CategorySheet`, `CategoryTile`     |
| Expense form               | `AmountFields`, `CategoryPicker`, `DateChips`, `DateField`              |
| Category form              | `CategoryForm`                                                          |
| Settings                   | `AppearancePicker`, `LedgerPicker`, `PendingInvites`, `NotionSyncPanel` |
| States used across screens | `EmptyMonth`, `LoadError`, `UndoToast`                                  |
| Demo                       | `DemoStrip`                                                             |

Known cases from the 103 plan's outline:

- `CategoryTile`: the letter and corner sizes are maths on the tile size (`size * 0.3`, `size * 0.43`), so they
  stay as allowlisted layout maths.
- `TabBar`: badge position maths is allowlisted; `BADGE_SIZE / 2` becomes `radius.pill`.
- `CategorySheet`: the top corners 26 become `radius.xl`.
- `EmptyMonth`: radius 16 becomes `radius.md`.
- `HomeCards`: the figure goes 20 → `title` (22), which is more than 1pt.
- `MonthSwitcher`: the small capitals eyebrow has `letterSpacing: 0.5`. Either keep it allowlisted (capitals need
  positive tracking) or use `caption`'s 0. The plan picks one and says why.

## Acceptance criteria

- [ ] None of the 22 files sets `fontSize`, `lineHeight`, `letterSpacing`, `borderRadius`, `padding*`, `margin*`
      or `gap` to a number literal, except allowlisted layout maths with a reason on the line above.
- [ ] `notOnTokensYet` lists only the 103c files (the screens: category detail, category form, delete category,
      expense, income item, login, members, no-ledger).
- [ ] Every money figure in these components has tabular digits (for example the Home cards and the collapsed
      Expenses header).
- [ ] A text input never renders below 16px on web, so iOS Safari doesn't zoom in when it's focused (amount field,
      category name and amount fields).
- [ ] Before and after layout snapshots at 390×844, light and dark (web), of: all six tabs, the expense form, the
      category form, the Budget category sheet, the Undo toast after a delete, an empty month, and the demo. The
      only differences are spacing shifts up to 2pt and font sizes up to 1pt, plus anything over that which is
      listed in the PR and approved.
- [ ] The demo build renders with no console errors.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The screens left for 103c (category detail, category form screen, delete category, expense, income item, login,
  members, no-ledger) and `theme.dangerText`.
- New shared components (`Card`, `Button`, `IconButton` and the rest): brief 104.
- Colours, Inter, shadows, removing borders, the caution colour change: brief 105.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Size: about 365 changed lines by the 103 plan's estimate, under the ~400 limit for one PR.
- Version: patch (styling, no new capability), 1.17.2 → 1.17.3, unless main has moved by then.
- Before snapshots need a fresh baseline from main (the ones in local storage from 103 are pre-103). The recipe
  from 103 works: a signed-in test user with a seeded ledger on `http://localhost:8081`, the demo on `:8084`,
  and layout snapshots in local storage keyed `snap:before:<path>:<scheme>`.
- Check on iPhone (Expo Go) at Gate B: the tab bar and the expense form's inputs, where iOS and web differ most.

## Open questions

- **Inputs at 16.** The type scale has no 16pt role, and the `body` role (15) would make iOS Safari zoom on focus.
  Recommended: add an `input` role to `theme.ts` and the spec (16 / 22, `body` face, −0.2 tracking) and use it
  for every text input and input-like field (`DateField` sits next to the amount input). The alternative is
  allowlisting `fontSize: 16` on each input. Brief 105 needs the same answer for Inter.

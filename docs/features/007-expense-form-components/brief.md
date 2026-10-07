# Expense form components

Type: chore

## Why

`apps/mobile/src/app/expense.tsx` is ~467 lines. It mixes data loading, form state and a lot of presentational markup,
which makes it hard to read and review. Brief 004 (expense screen data hooks) wants the screen at about 300 lines, and
measuring showed that hooks alone don't get there (451 lines). This brief is the first step of 004's split, agreed at
Gate A: move the presentational pieces out first, as pure moves, so 004's diff is about behaviour only.

## What

Three presentational components in `apps/mobile/src/components/`, each moved out of `expense.tsx` with its styles:

- `AmountFields`: the UAH field, the swap icon and the EUR field.
- `CategoryPicker`: the quick category tiles, the "N more" tile and the `CategorySheet` it opens.
- `DateChips`: the date field with the Today and Yesterday chips.

No behaviour, text, layout or accessibility change. They take props and call callbacks; they don't call the API.

## Acceptance criteria

- [ ] `components/AmountFields.tsx`, `components/CategoryPicker.tsx` and `components/DateChips.tsx` exist, and
      `expense.tsx` imports and renders them. None of them imports `@/api/client` or `@/auth`.
- [ ] `expense.tsx` is ≤ ~340 lines after the moves (measured 340; Base 467).
- [ ] New expense and Edit expense look identical before and after at 390×844 in the web build (screenshots of the date
      row, the category group and the amount row).
- [ ] Behaviour is unchanged:
  - typing 100 in UAH fills EUR, and typing in EUR fills UAH;
  - a quick tile tap selects it without reordering the row;
  - picking from "N more" puts that category in the last quick spot and closes the sheet;
  - Today and Yesterday set the date, and the date field still can't go past today;
  - the same accessibility labels and roles are exposed.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green on every commit; web and iOS (Expo Go)
      checks recorded in the PR.

## Out of scope

- Data hooks, the Retry/error view, error texts, the rate label, the busy-button accessibility and the Undo label
  (brief 004).
- Any API change.
- Theme tokens for the raw hex values that move with the styles (brief 006).
- Other screens.

## Notes

- Runs before brief 004, which starts from main after this merges.
- Each component has one caller. That is accepted here only because 004's line target needs it.

## Open questions

- None.

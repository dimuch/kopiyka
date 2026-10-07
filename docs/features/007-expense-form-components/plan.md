# Plan: Expense form components

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/expense-form-components
Base: origin/main (c813684)

## Approach

Three pure moves in `apps/mobile`, one commit each. I built each slice on a scratch copy of Base, in order. Each passed
`prettier --check`, `tsc --noEmit` and `eslint --max-warnings 0` with the repo's configs. The API is untouched, so
`yarn test` is unaffected.

- Each component takes its JSX and styles from the screen unchanged. Where the screen spread the shared `field` box
  style, the component writes it out, as `DateField` already does.
- `CategoryPicker` owns `sheetOpen`. The screen keeps one `pickCategory(c)`: `setQuick((q) => withQuick(q, c.categoryId))`,
  `setCategoryId`, `setError(null)`. A quick tap goes through it too; `withQuick` returns the same array when the id is
  already in the row, so nothing reorders.
- `DateChips` computes Yesterday as `addDays(today, -1)`. The screen keeps its one clock read (`kyivToday(new Date())`)
  and the why-comment for it.

Measured `expense.tsx`: 467 lines on Base, then 411 after slice 1, 361 after slice 2 and 340 after slice 3.

Alternative considered: one commit for all three. It's harder to review as moves; three commits let each be checked
with `git show --color-moved`.

## Contracts

- DB: none. API: none.
- `apps/mobile/src/api/types.ts`: add `export type Currency = 'EUR' | 'UAH';`. The screen imports it instead of its
  local alias, and `AmountFields` imports it too. `Expense.enteredCurrency` stays as it is.
- `components/AmountFields.tsx`:
  `{ entered: Currency; amountText: string; otherText: string; onChange: (currency: Currency, text: string) => void }`.
  - It renders the UAH field, the swap icon and the EUR field. A field shows `amountText` when its currency is
    `entered`, and `otherText` otherwise.
  - The module-private `AmountField` moves with it, keeping its labels, `nativeID`, `accessibilityLabel` and
    `keyboardType`.
  - The screen renders `<AmountFields entered={entered} amountText={amountText} otherText={otherText} onChange={typeAmount} />`.
- `components/CategoryPicker.tsx`:
  `{ quick: Category[]; more: Category[]; selectedId: number | null; onPick: (category: Category) => void }`.
  - It renders the tiles (`accessibilityState.selected`), the "N more" tile (label "More categories") and
    `CategorySheet`.
  - A sheet pick closes the sheet, then calls `onPick`.
- `components/DateChips.tsx`: `{ value: string; today: string; onChange: (date: string) => void }`. It renders
  `DateField` (`max={today}`, label "Date") and the Today / Yesterday chips (`accessibilityState.selected`).
- New dependencies: none.

## Slices

Sizes are `git show --stat` on the scratch build: 385 changed lines in total, nearly all moved.

- [x] 1. Move the amount inputs into an AmountFields component
  - Files: `components/AmountFields.tsx` (new), `app/expense.tsx`, `api/types.ts` (`Currency`)
  - Change: move `AmountField`, the amount row and the `amountRow`, `swap`, `symbol` and `amountInput` styles.
  - Verify: in the in-app browser (launch configs `api` + `web`, 390×844), the amount row screenshot is identical
    before and after. Typing 100 in UAH still fills EUR, and typing in EUR still fills UAH. Edit expense shows both
    stored amounts.
  - 155 lines (95+/60−).
- [ ] 2. Move the category row and its sheet into a CategoryPicker component
  - Files: `components/CategoryPicker.tsx` (new), `app/expense.tsx`
  - Change: move the tiles, the "N more" tile, `CategorySheet`, `sheetOpen` and the `catGrid`, `cat`, `catText` and
    `more` styles. One `pickCategory` replaces the two inline handlers.
  - Verify:
    - The category group screenshot is identical.
    - A quick tap selects without reordering.
    - "N more" opens the sheet; a pick takes the last quick spot and closes it.
  - 152 lines (94+/58−).
- [ ] 3. Move the date field and Today/Yesterday chips into a DateChips component
  - Files: `components/DateChips.tsx` (new), `app/expense.tsx`
  - Change: move the date row and the `dateRow`, `chip`, `chipOn` and `chipText` styles. `yesterday` leaves the screen.
  - Verify: the date row screenshot is identical. Today and Yesterday set the web date input to the Kyiv dates, and the
    field doesn't accept dates after today.
  - 78 lines (54+/24−).

## AC → evidence

| AC                                                                | Evidence                                                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three components exist, used by `expense.tsx`, no API/auth import | `rg -n "AmountFields\|CategoryPicker\|DateChips" apps/mobile/src/app/expense.tsx`; `rg -n "@/api/client\|@/auth" apps/mobile/src/components` is empty |
| `expense.tsx` ≤ ~340 lines                                        | `wc -l` after slice 3: 340, as measured                                                                                                               |
| Identical look at 390×844 (New and Edit)                          | Before/after screenshots per slice (date row, category group, amount row)                                                                             |
| Behaviour unchanged                                               | Slice checks above; `git show --color-moved` shows each block as moved                                                                                |
| Gates green; web + iOS recorded                                   | All four gates on every commit; iPhone (Expo Go): Add and Edit open, a typed amount converts, a sheet pick works, the chips work                      |

## Not doing (YAGNI)

- Any data, error, label or accessibility change (brief 004).
- Theme tokens for the moved hex values (brief 006).
- Extracting anything else, like the "Added" note or the error view.
- Sharing a `field` style token between components (`DateField` already keeps its own copy).

## Risks

- **`CategorySheet` now renders inside the picker's grid `View`.** RN `Modal` is a portal on web and a native modal on
  iOS, so layout is unaffected. Slice 2's screenshot and the iPhone check prove it.
- **The copied styles could drift from the originals.** The screenshots per slice catch it. The amount input's merged
  style was checked against `input` + `amountInput` (`paddingLeft: 32`, `paddingRight: 14`, `bodyMedium`,
  tabular nums).

## Open questions

- None.

## Follow-ups

- None new. Brief 004 continues from this one.

## Deviations

None.

## Revision 1

Split out of brief 004's plan at Gate A (2026-10-07), as 004's slices 1–3, with the same numbering. This brief and plan
ship first, on their own branch from origin/main. The user approved the plan at Gate A, with this change from the
skeptic's edits: `Currency` is added to `api/types.ts` only for `AmountFields` and the screen. `Expense.enteredCurrency`
is no longer retyped, so slice 1 is 155 lines instead of 157.

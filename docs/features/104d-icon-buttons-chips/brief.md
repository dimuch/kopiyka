# Shared components, part 4: IconButton and Chip

Type: chore

## Why

Part 4 of brief 104 (split at its Gate A into 104–104f; parts 1–3 are #156, #160 and #161). The app's icon-only
buttons and its selectable chips are hand-written: 11 icon buttons on 8 screens and components, each with its own
44×44 box, corner and icon colour, and 3 chip styles that repeat the same border, fill and "selected" colours. Brief 105
turns icon buttons into round 44pt buttons (some raised with a shadow) and chips into 32pt pills. With `IconButton`
and `Chip` that is two components to change; without them, 14 copies.

## What

Add `apps/mobile/src/components/IconButton.tsx` and `Chip.tsx` and move these onto them. **They draw today's look**, so
nothing visibly changes. The outline in `git show 6b547bc1:docs/features/104-shared-components/plan.md` ("Later parts", 104d) is the
starting point.

**IconButton** (44×44, the icon centred):

| Button             | Where                         | Today                                                        |
| ------------------ | ----------------------------- | ------------------------------------------------------------ |
| Home               | `components/HomeButton`       | `home`, muted, `radius.md`                                   |
| Add expense ("+")  | `components/AddExpenseButton` | `plus`, accent, `radius.md`                                  |
| Previous, Next     | `components/MonthSwitcher`    | `back` / `forward`, muted, `radius.md`                       |
| Previous, Next     | `app/(tabs)/statistics`       | the same; Next is disabled and `fainter` at the newest month |
| Add a category "+" | `app/(tabs)/budget`           | `plus`, accent, `radius.md`                                  |
| Edit (pencil)      | `app/(tabs)/budget`, each row | `edit` at 18pt, muted, **no corner**, 8pt margin right       |
| Add income "+"     | `app/(tabs)/income`           | `plus`, accent, `radius.md`                                  |
| Category actions ⋯ | `app/category/[categoryId]`   | `more`, muted, `radius.md`                                   |
| Close              | `components/CategorySheet`    | `close`, muted, **no corner**, pulled right 8                |

**Chip** (48pt high today, `radius.md`, 1pt `borderStrong` edge; selected: `accent` edge on `accentTint`):

| Chips                    | Where                       | Today                                                                               |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------- |
| Today, Yesterday (dates) | `components/DateChips`      | `surface`, label text, as wide as the label, `aria-selected`                        |
| Categories, "N more"     | `components/CategoryPicker` | `surface`, a third of the row, letter tile and label; "more" is dashed, transparent |
| Categories in the sheet  | `components/CategorySheet`  | `surfaceRaised` (differs from `surface` in dark), half the row                      |

- `IconButton` takes the icon, an accessibility label, `onPress`, a tone (muted or accent), and `disabled` (the icon
  turns `fainter`), plus the props its callers pass today (`aria-expanded`, the icon size, style). The plan decides
  the API; each option is used by at least two callers, and a one-off stays a style override or an exception.
- `Chip` takes `selected` and its content. The sheet's raised surface and the dashed "more" become an option or stay
  overrides, as the plan decides.
- Roles, labels, `disabled`, `aria-selected` and `aria-expanded` stay exactly as today.

## Acceptance criteria

- [ ] `IconButton` and `Chip` exist in `apps/mobile/src/components/`, read only tokens and the palette, and add no
      new token.
- [ ] The buttons and chips above render through them. Outside the two components, no style repeats the 44×44 icon
      box or the chip's selected colours, apart from listed exceptions with a reason.
- [ ] Before and after layout snapshots (the 104 plan's "Snapshot script") at 390×844, light and dark, of every view
      that shows one: Home, Budget, Income, Expenses, Statistics (newest month, so Next is disabled), a category page
      with its ⋯ menu open, and the expense form with the category sheet open. Nothing moves; any shift is listed in the
      PR and approved.
- [ ] A selected and an unselected chip of each kind look and read as before, and so does Statistics' disabled Next.
- [ ] Roles, labels, `disabled`, `aria-selected` and `aria-expanded` are unchanged (the snapshots' accessibility record).
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- The header Back buttons (the category page's and Members' icon Back with a label, the forms' text Back): 104e's
  `ScreenHeader`.
- Budget's Start → End line (a 13pt label with a 14pt pencil), Statistics' period button (label and chevron), Settings'
  Members row, HomeCards, the tab bar and the `AmountFields` swap and `DateField` calendar icons, which aren't icon
  buttons.
- AppearancePicker's segmented options and the Statistics period menu's radio rows: not chips, unless the plan finds
  they fit without a change.
- `Text`: 104f. Brief 105's look (round buttons, shadows, 32pt pills) and anything that changes behaviour, copy or
  labels.

## Notes

- Base: main dab7b78, v1.23.4. Version: patch, 1.23.4 → 1.23.5, unless main moves first.
- Size: the 104 plan estimated about 260 + 90 lines. Split into an IconButton part and a Chip part if the plan
  measures more than 400.
- The 104 plan noted that Budget's pencil and the sheet's close would gain `radius.md`, which only shows as a rounder
  web focus ring. Either keep their square corner or list the change; the plan decides.
- Test data: one fresh QA user (`yarn api create-user --username claude-qa-104d …`) with November data, and delete it
  when the brief is done. The other parts showed the order that works: seed through the API as the user, take every
  view in Light then Dark, and check `innerWidth === 390` in each result.
- Check on iPhone (Expo Go) at Gate B: the month arrows and a category chip on the expense form.

## Open questions

- Gate A: `IconButton`'s API. A `tone` (`muted`, `accent`) for the icon colour, or the colour passed in?
- Does the category sheet's raised chip become a `Chip` option (`raised`), or a style override, given 105 changes
  both?
- Keep the two square-cornered icon buttons square (an override), or give them `radius.md` and list the focus-ring
  change?

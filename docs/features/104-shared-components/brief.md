# Shared components: Text, Card, Button, IconButton, Chip, ScreenHeader and ProgressBar

Type: chore

## Why

Brief 103 put every style on the `space`, `radius`, `size` and `text` tokens, but each screen still writes out its own
copy of the same few shapes. A survey of `apps/mobile/src` on main 3168377 (v1.20.1) found:

- **Headers:** 11 hand-built header rows in four shapes. The four form screens (category form, delete category, income
  item, expense) repeat the same text-only Back, centred 17pt title and `<View style={{ width: 52 }} />` spacer, line
  for line.
- **Buttons:** 11 filled buttons, 3 outlined danger buttons, 5 danger text buttons, 2 grey text buttons and 6 accent
  link buttons. Each has its own height, radius, disabled opacity and spinner placement.
- **Icon buttons:** 9 copies of the 44×44 icon button style, 7 of them identical.
- **Cards:** about 16 copies of `surface` + 1pt `border` + `radius.lg`, plus 7 raised surfaces (menus, toast, sheets,
  Members' panel).
- **Chips:** 3 chip grids (DateChips, CategoryPicker, CategorySheet) sharing the same 48pt box and selected style.
- **Progress bars:** one, on the Expenses tab.
- **Text:** about 175 `<Text>` call sites. The same role + face + colour combinations appear again and again, for
  example `body` + medium + `text` 14 times, `label` + regular + `muted` 13 times, and `heading` + display face 11
  times.

Brief 105 (the fresh look) restyles exactly these shapes: no borders, shadows, pills, Inter and violet. With shared
components it changes them in one place each. Without them it has to edit every copy and keep them in step by hand.

## What

Add these components to `apps/mobile/src/components/`, with the shapes in `docs/design/design-system.md`
("Components"). **For this brief they draw today's look.** Their styles come from today's palette and tokens, so
nothing visibly changes. Then move the copied styles onto them.

| Component      | Replaces                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`         | `<Text style={[...text.x, fontFamily, color]}>`: a `variant` prop from the text roles, with colour defaulting to `text`. A screen's own layout style still passes.                              |
| `Card`         | the `surface` + `border` + `radius.lg` boxes (padded, list and picker group); the raised menus and panel only if they fit without a shift                                                       |
| `Button`       | filled (accent, danger), outlined danger, and the text buttons (danger, grey, accent link); busy (spinner) and disabled states; `outlinedDanger*` and `dangerText` in `theme.ts` go once unused |
| `IconButton`   | the 44×44 icon buttons, `HomeButton`'s and `AddExpenseButton`'s boxes, and MonthSwitcher's arrows                                                                                               |
| `Chip`         | the DateChips, CategoryPicker and CategorySheet chips, with the selected state                                                                                                                  |
| `ScreenHeader` | the header rows: Back (text or icon + label) or Home, a title or the MonthSwitcher, and one optional trailing action                                                                            |
| `ProgressBar`  | the Expenses tab's track and fill (`progressColor` stays in `theme.ts`)                                                                                                                         |

The plan decides how many variants each component needs from the call sites, and which call sites stay as they are
because they don't fit. Every call site that stays gets a one-line reason in the plan. Examples: the radio rows
(AppearancePicker, LedgerPicker, the Statistics period menu), the toast, and the sheets.

## Acceptance criteria

- [ ] The seven components exist in `apps/mobile/src/components/`. Each reads only tokens and `useColors` /
      `useThemedStyles`, adds no new token, and has `accessibilityRole` and label support where it's pressable.
- [ ] No screen or component outside them still hand-writes a filled/outlined button, a 44×44 icon button box, a
      `surface` + `border` + `radius.lg` card, a chip box or a header row. The exceptions are listed in the plan, each
      with a reason.
- [ ] Every text in `apps/mobile/src` renders through `Text`, apart from exceptions listed with a reason (for example
      `CategoryTile`'s size-derived letter, or text inside `TextInput`).
- [ ] Before and after layout snapshots at 390×844, light and dark (web), of: the five tabs, the category screen, the
      expense form (new and edit), the category form, delete category, the income item, Members, login and no-ledger.
      The only differences are shifts up to 2pt. Every larger shift is listed in the PR and approved.
- [ ] Accessibility doesn't regress: labels, roles and states are unchanged, and every touch target stays ≥44pt.
      Where a header title gains `accessibilityRole="header"`, the PR says so.
- [ ] The demo build renders the same screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Brief 105, the fresh look:
  - colours, the violet palette, Inter, shadows, removing borders, new radii, violet bars and the 4pt bar with its dot
  - light `caution` `#F2C94C`, the new `cautionText` token (`#8A6600` light / `#F2C94C` dark) and the "€15 left"
    label on near-plan rows
  - whether new installs default to the light theme
- Brief 106: the floating tab bar and its "+" button. `TabBar.tsx` stays as it is.
- Unifying sizes that differ today, for example 56 vs 48 vs 44pt filled buttons or radius 20 vs pill. Components keep
  today's sizes through their variants or props. Brief 105 collapses them to the spec.
- Text inputs (`TextField`), the radio/option rows, sheets, the toast and the reorder list, unless the plan shows one
  fits a component with no shift.
- Any change to behaviour, copy or accessibility labels.

## Notes

- Base: main 3168377, v1.20.1. Version: patch per PR (1.20.1 → 1.20.2 for the first), unless main moves first.
- **Size is the main risk.** Replacing ~175 `<Text>` call sites alone touches ~35 files. Together with the rest this
  is well over the ~400-line limit for one PR. Expect to split at Gate A into sequential briefs, not stacked PRs.
  A possible cut:
  - 104: `IconButton`, `ScreenHeader`, `Card` and `ProgressBar`
  - 104b: `Button` and `Chip`
  - 104c: `Text` across every screen
- Things the survey found that will cause shifts over 2pt if unified, which this brief therefore doesn't unify:
  - filled button heights 56/48/44, radii 20/pill/14 and disabled opacity 0.6/0.5/0.4
  - the four form screens' 8pt top padding against 20pt elsewhere, and their 52pt spacer against the 44pt icon slot
  - chips at 48pt (the spec's `size.chip` 32 is unused until 105)
  - NotionSync's 13pt button text
  - the Undo button's 56pt height
- Two weight inconsistencies the survey found, which `Text` will either keep or fix:
  - the expense and income-item inputs type in regular weight, while the other inputs use medium
  - login's field label is medium, while the other field labels are semibold

  A fix is a visible (sub-2pt) change, so list it in the PR.

- Layout snapshots: the 103b–103d recipe (`api` + `web` on :8081, in-app browser at 390×844, `kopiyka.theme` in local
  storage, keys `snap:before:104:<view>:<scheme>`). Use test user `claude-qa-103b` (#168, ledger 165). Create any
  extra test users with `yarn api create-user` and delete them when done.
- Check on iPhone (Expo Go) at Gate B: headers (safe area), buttons with spinners, and chips.
- `codebase-design` and `vercel-composition-patterns` apply: small props, no boolean soup. A `variant` union beats
  `isPrimary` / `isDanger` flags.

## Open questions

- **Text migration scope:** every `<Text>` (AC3, ~175 sites), or only the combinations used 3+ times, leaving one-offs
  as `Text` with a style? I recommend every site, so brief 105's font swap reaches all of them. It goes in its own part.
- **ProgressBar** has one call site, so the rule of three says don't extract it. The spec lists it, and brief 105
  gives it a dot and a new height. Extract it now, or leave it to 105?
- **Card's padding:** a `padding` prop (`none` / `xs` / `lg`) for the three shapes in use, or let callers pass it in
  `style`?

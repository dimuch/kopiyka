# Shared components, part 5: ScreenHeader

Type: chore

## Why

Part 5 of brief 104 (split at its Gate A into 104–104f; parts 1–4 are #156, #160, #161 and #163). Every screen builds
its own top row. The 5 form screens copy one header (text Back, centred title, a 52pt spacer), the 3 month tabs copy
another (Home, month switcher, an optional action, on equal-width sides), and the category page and Members copy a
third (icon Back with a label). Brief 105 restyles headers (Back and actions become round icon buttons, titles move to
the new type roles). With one `ScreenHeader` that is one component; without it, 10 copies.

## What

Add `apps/mobile/src/components/ScreenHeader.tsx` with three variants, no booleans, and move the headers onto it.
**It draws today's look**, so nothing visibly changes. The outline in `docs/features/104-shared-components/plan.md`
("Later parts", 104e) is the starting point.

| Variant | Screens                                                               | Today                                                                                                              |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `modal` | category form, income item, expense form, delete category, actual End | text Back (muted, 44pt, pulled left 8), centred `heading` title in the display face, a 52pt spacer; 8pt below      |
| `month` | Budget, Income, Expenses                                              | Home on the left, `MonthSwitcher` centred, an optional action on the right; equal-width sides; 8pt below           |
| `page`  | the category page (and its bad-link view), Members                    | icon Back with a label (the month name, or "Back"), optional trailing content, the category page's `HeaderDivider` |

- The modal Back is built on 104c's `mutedText` `Button`; the page Back keeps its icon and label.
- Each screen keeps its own top padding (the forms' 8pt) and what sits below the header.
- Statistics (Home beside a left-aligned title and its period controls) becomes a fourth variant or stays as it is,
  as the plan decides. Home's ledger title isn't a header row and stays.
- Back's behaviour stays per screen (`closeToBudget`, `leave`, `goBack`, `router.back`), passed in as `onBack`, and
  so does `disabled` while a form is saving.

## Acceptance criteria

- [ ] `ScreenHeader` exists in `apps/mobile/src/components/`, reads only tokens and the palette, adds no new token, and
      has a `variant` prop with no boolean props.
- [ ] The 10 headers above render through it. Outside `ScreenHeader.tsx`, no screen keeps the 52pt spacer, the
      equal-width `side` styles or its own Back pressable, apart from listed exceptions with a reason.
- [ ] Before and after layout snapshots (the 104 plan's "Snapshot script", 104d's version) at 390×844, light and dark,
      of every view with one of these headers: the 5 forms (add or edit), Budget, Income, Expenses, a category page,
      a category bad link, and Members. Nothing moves; any shift is listed in the PR and approved.
- [ ] The Back buttons' disabled state while a form saves looks and reads as before (check one form while busy), and
      the category page's divider still appears when its list scrolls.
- [ ] Roles, labels and `disabled` are unchanged (the snapshots' accessibility record). If the modal titles gain
      `accessibilityRole="header"`, the PR says so and lists it as the one intended change.
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Home's ledger title, Settings, login, no-ledger and the tab bar, which have no header row of this kind.
- The month switcher itself (`MonthSwitcher`) and Budget's Start → End line under the header.
- `Text`: 104f. Brief 105's look (round icon Back, new type roles, shadows) and the floating tab bar (106).
- Any change to behaviour, copy or labels, apart from the header role the plan may propose.

## Notes

- Base: main 60b18a6, v1.23.6. Version: patch, 1.23.6 → 1.23.7, unless main moves first.
- Size: the 104 plan estimated about 340 lines. Split by variant if the plan measures more than 400.
- Test data: one fresh QA user (`yarn api create-user --username claude-qa-104e …`) with November data seeded through
  the API, deleted when the brief is done. Take both snapshot sets on the same day in November.
- Lessons from 104b–104d: keep absolute local paths (scratch folders, home directories) out of every committed file;
  when the Browser pane is hidden, take a screenshot after opening anything animated before snapshotting; check
  `innerWidth === 390` in every result.
- Check on iPhone (Expo Go) at Gate B: a form's Back, a month tab's header, and the category page's Back.

## Open questions

- Gate A: does Statistics become a fourth variant or stay an exception?
- Should the modal titles gain `accessibilityRole="header"` now (a small accessibility gain, listed in the PR), or
  wait for 104f/105 so this part stays a pure refactor?
- How does the `month` variant take its right-hand action: a `trailing` slot, or named props for the "+" buttons?

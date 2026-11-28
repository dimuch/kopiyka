# Shared components, part 6: Text

Type: chore

## Why

Part 6, the last, of brief 104 (split at its Gate A into 104–104f; parts 1–5 are #156, #160, #161, #163 and #166).
Screens draw text with React Native's `Text` and a local style that spreads a `text` role and then patches it: a
different face (61 `fontFamily: fonts.*` overrides), a colour, alignment. The same patches repeat: "body in the
medium face, `text` colour" 13 times, "label in the regular face, `muted`" 10 times, "label in the semibold face,
`muted`" (field labels) 6 times, "heading in the display face" 8 times. Brief 105 switches the font to Inter and
retunes the roles. With one `Text` that takes a variant and a colour, that is a change in `theme.ts` and one
component; without it, 118 style objects and 61 face overrides to edit by hand.

## What

Add `apps/mobile/src/components/Text.tsx` and move the app's text onto it. **It draws today's look**, so nothing
visibly changes. The outline in `git show 6b547bc1:docs/features/104-shared-components/plan.md` ("Later parts", 104f) is the starting
point.

- `Text` takes a `variant` (the `text` roles: `display`, `title`, `heading`, `body`, `bodyStrong`, `label`, `caption`,
  `amount`, `amountLg`) and a `color` from the palette, defaulting to `text`, plus React Native `Text`'s own props
  (`numberOfLines`, `accessibilityRole`, `style` for layout, and so on).
- The recurring role-and-face combinations become named variants, so no screen sets `fontFamily` for them. The plan
  picks the names; for example `rowName` (body, medium face), `meta` (label, regular face), `fieldLabel` (label,
  semibold face) and `screenTitle` (heading, display face).
- The sites today: 140 `<Text>` elements in 38 files, across `app/`, `components/`, `demo/` and `demo-app/`. The
  shared components from 104–104e (`Button`, `ScreenHeader`, `Card` hosts and so on) move too.
- Exceptions, kept as allowlisted styles with a reason:
  - `CategoryTile`'s letter, whose size comes from the tile's size
  - text in `TextInput`s (they aren't `Text`), including `DateField`'s value
  - `TabBar`'s badge (TabBar belongs to brief 106)
  - `MonthSwitcher`'s eyebrow and the category page's day labels, which add +0.5 letter spacing for capitals
- A nested `Text` must not override the colour it inherits.

## Acceptance criteria

- [ ] `Text` exists in `apps/mobile/src/components/`, reads only `theme.ts`'s roles and the palette, and adds no new
      token. Any named variant is built from an existing role and face.
- [ ] Every `<Text>` outside the listed exceptions renders through it. Outside `Text.tsx` and `theme.ts`, no style
      spreads a `text` role or sets `fontFamily`, apart from the listed exceptions.
- [ ] Before and after layout snapshots (the 104 plan's "Snapshot script", 104e's version) at 390×844, light and dark,
      of every screen with text: Home, Budget, Income, Expenses, Statistics, Settings, a category page, the 5 forms,
      Members, login, no-ledger and the demo strip. Nothing moves; any shift is listed in the PR and approved.
- [ ] Roles and labels are unchanged (the snapshots' accessibility record), including `header` and `alert` roles set
      on text today.
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- Brief 105's look: Inter, the new sizes and tracking, colours.
- `TextInput` styling and `TabBar` (106).
- Any change to copy, labels or behaviour, except a weight inconsistency the user chooses to fix at Gate A.

## Notes

- Base: main 137a9eb, v1.23.8. Version: patch, 1.23.8 → 1.23.9, unless main moves first.
- Size: the 104 plan estimated about 350 lines, with a split into components and screens if it passes 400. 140 sites
  make a split likely: the plan measures and proposes the parts (for example 104f for `Text` and the components, 104g
  for the screens).
- Two weight inconsistencies the 104 brief noted, for Gate A to keep or fix (a fix is listed in the PR):
  - the expense and income-item amount inputs type in the regular weight, while `DateField`'s value is medium;
  - login's field labels use `label` in its own medium face, while the other forms' field labels are semibold.
- After this part, conventions §5 could point new code at the seven 104 components. That's a proposal for the end of
  the brief, not a slice.
- Test data: one fresh QA user (`yarn api create-user --username claude-qa-104f …`) with November data seeded
  through the API, deleted when the brief is done. Take both snapshot sets on the same day in November.
- Lessons from 104b–104e:
  - keep absolute local paths (scratch folders, home directories) out of every committed file;
  - another session may share the MySQL test database: if the integration tests fail in the schema reset, wait until
    the other run is idle and run again, and never let a commit follow a failed `yarn test`;
  - avoid clicking in the Browser pane while snapshots are compared; check `innerWidth === 390` in every result.
- Check on iPhone (Expo Go) at Gate B: Home, Budget and a form in both themes, and text at a large Dynamic Type size.

## Open questions

- Gate A: the names and number of the combination variants, and whether a one-off combination becomes a variant or
  stays a `style` override.
- How `color` is passed: a palette key (`color="muted"`) or a value (`color={colors.muted}`)?
- One PR or a split (likely), and where to cut.
- Keep or fix the two weight inconsistencies.

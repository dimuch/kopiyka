# Shared components, part 7: Text on the tab screens

Type: chore

## Why

Part 7 of brief 104. At 104f's Gate A, the `Text` part was split three ways:

- 104f (#169) built `Text` and moved the shared components and the demo strip onto it.
- This part moves the tab screens and the category page.
- 104h moves the rest.

These screens still draw text with React Native's `Text` and a local style. Each style spreads a `text` role and
patches its face, colour or digits. Until they go through `Text`, brief 105's new type has to be edited into each
screen by hand.

## What

Move every `<Text>` on these screens onto `Text` (`apps/mobile/src/components/Text.tsx`). **It draws today's look**,
so nothing visibly changes. The outline is in `git show 3b0c637b:docs/features/104f-text-component/plan.md`, under "Later parts" › 104g.

- **Screens:** Home, Budget, Income, Expenses, Statistics, the category page and the demo's Home: 50 `<Text>`
  elements in 7 files.
  - `app/(tabs)/index.tsx`, `budget.tsx`, `income.tsx`, `expenses.tsx` and `statistics.tsx`
  - `app/category/[categoryId].tsx`
  - `demo-app/(tabs)/index.tsx`
- **Variants and props:** use 104f's variants, `color` palette keys and the `tabular` flag. The one new pair the 104f
  plan foresaw is `captionMedium` (caption in the medium face), for Expenses' "€9 over". It's added to `Text.tsx`
  with its caller.
- **State switches go through props, not style patches.** These include Budget's and Expenses' figure colours,
  Statistics' negative amounts, over gaps and checked period, and the category page's over amounts.
- **The nested " of €…" in Expenses** becomes a nested `Text` with `color="muted"`. It inherits its parent's size and
  tabular digits, as today.
- **Comments that sit on a removed style move to the JSX.** Examples: Expenses' "€9 over" contrast note, Income's
  total, and the ⋯ menu row being "not a button".
- **The category page's day labels** keep their +0.5 letter spacing as a `style`, with its existing reason.

## Acceptance criteria

- [ ] In the 7 files, every `<Text>` renders through `Text`, and no style spreads a `text` role or sets `fontFamily`.
- [ ] `Text.tsx` gains only `captionMedium`, built from an existing role and face. It adds no new token.
- [ ] Before and after layout snapshots at 390×844, light and dark, using the 104f plan's snapshot script (it records
      font family, size, line height, tracking, tabular digits, weight and alignment):
  - `home`, `budget`, `budget-ended`, `income`, `expenses`, `expenses-scrolled`, `statistics` and `statistics-menu`
  - `category`, `category-scrolled`, `category-menu` and a category with no expenses
  - `demo-home`

  Nothing moves; any shift is listed in the PR and approved.

- [ ] Roles and labels are unchanged (the snapshots' accessibility record).
- [ ] The demo build renders the touched screens with no console errors, and `yarn mobile check-builds` passes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- 104h's screens (Settings, Members, the form screens, login, no-ledger) and the final search over all of `src`.
- Brief 105's look: Inter, new sizes, tracking and colours.
- `TextInput` styling and `TabBar` (brief 106).
- Any change to copy, labels or behaviour.

## Notes

- Base: main 3b0c637, v1.23.9. Version: patch, 1.23.9 → 1.23.10, unless main moves first.
- Size: the 104f plan estimated about 256 lines. The plan measures it again.
- Test data: one fresh QA user (`claude-qa-104g`) with November data seeded through the API. The data should cover:
  - a category over plan and one near plan
  - a category with no expenses
  - income items
  - an ended month for `budget-ended`
  - enough expenses for Expenses and the category page to scroll

  Delete the user when the brief is done.

- Take both snapshot sets on the same Kyiv day, well before midnight: the date text changes at midnight (104f's
  lesson).
- Lessons from 104b–104f:
  - Keep absolute local paths out of every committed file.
  - The MySQL test database is shared with other sessions. If the integration tests fail in the schema reset, wait
    and run them again. Never let a commit follow a failed `yarn test`.
  - Avoid clicking in the Browser pane while snapshots are compared, and check `innerWidth === 390` in every result.
- Check on iPhone (Expo Go) at Gate B: Home, Budget, Expenses and Statistics, in both themes.

## Open questions

- One PR, or split again if the measured size passes 400 lines?
- Statistics' checked period: `bodyStrong`, as the 104f plan suggests, or a state switch between `body` and
  `bodyStrong`?

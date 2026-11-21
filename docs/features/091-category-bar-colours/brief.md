# Colour the category progress bar instead of highlighting the row

Type: feature

## Why

On the Expenses tab, a category row gets a warm background (`warnBg`) once spending reaches 90% of its plan, and its
progress bar stays blue (`accent`) whatever happens. The background marks only one state, and you can't tell from the
bar alone whether a category is fine, close to the plan or over it. Colouring the bar shows all three states.

## What

- **Expenses tab, category rows** (`apps/mobile/src/app/(tabs)/expenses.tsx`): the row loses the warning
  background in every state. The progress bar gets a colour from the month's spent vs planned for that category:
  - **green**: spent is under 90% of planned (this includes nothing spent yet);
  - **yellow**: spent is from 90% of planned up to and including planned. This is today's warning point, kept
    because "exactly on plan" to the cent would almost never happen (user's decision, 2026-11-21);
  - **red**: spent is above planned.
- The user's first wording was "planned < expenses → green, planned = expenses → yellow, planned > expenses →
  red". They confirmed on 2026-11-21 that they meant the usual reading: under plan is green, over plan is red.
- Edge cases follow the same rule in integer cents: €0 planned with anything spent is red (over plan). €0 planned
  with nothing spent is green, and its bar is empty.
- The bar's width, the "€X over" line and the row's accessibility label stay as they are.
- **Demo build:** it renders the same Expenses screen, so it changes with it. Nothing demo-specific.

## Acceptance criteria

- [ ] Unit test (`budgetProgress` or wherever the state lives): under 90% → green state, exactly 90% → yellow,
      equal to plan → yellow, 1 cent over → red, €0/€0 → green, €0 planned with spending → red. Cents boundaries
      as today (90% of 1001 cents: 900 is green, 901 is yellow).
- [ ] App test: a row's bar uses the colour for its state, and no row has the warning background.
- [ ] Each bar colour has at least 3:1 contrast against `track` in both light and dark palettes (WCAG non-text
      contrast). The colours come from theme tokens, not hard-coded in the screen.
- [ ] Demo build still passes (`yarn mobile check-builds`).
- [ ] Browser check at phone width (~390×844), web, light and dark mode: one row of each colour on screen (green,
      yellow, red), no row background. Screenshots in the PR.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- A progress bar on the Budget tab, the category detail screen, Home or Statistics (user's decision, 2026-11-21:
  Expenses tab only).
- The top-bar total's `over` colour in `CollapsingSummary` and the Budget tab's "Left to plan" colour.
- Changing the 90% threshold, the bar's size or the "€X over" text.
- The MCP connector.

## Notes

- Today: `budgetProgress(spentCents, plannedCents)` in `apps/mobile/src/data/budgetProgress.ts` returns
  `{ fill, warning, overCents }`. `warning` is spent > 0 and spent ≥ 90% of planned. The row applies
  `colors.warnBg` when `warning`. The bar is `colors.accent`.
- Existing tokens in `apps/mobile/src/theme.ts`: `active` (green, dark `#6FD08C` / light `#1B7A3D`) and `danger`
  (red, dark `#FF8A80` / light `#C23B31`). There is no yellow token: `over` is orange (`#FFA65C` / `#B25E09`). A
  yellow token is probably needed. Check its contrast against `track` (`#262A31` dark, `#E2E6EC` light), since a
  light-mode yellow easily falls below 3:1.
- Once the row background is gone, `warnBg` has no users: remove it, along with the `listCard` comment about keeping
  the warning background inside the rounded corners and the `overText` comment that mentions `warnBg`.
- A colour-only cue is fine here: the amounts and the "€X over" line already state the numbers in text.

## Open questions

- None. Mapping, yellow threshold and scope decided by the user on 2026-11-21.

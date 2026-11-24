# Expenses and Income polish: add per row, three figures, red "over", light yellow

Type: feature

## Why

Five small things on the Expenses and Income tabs, shipped together in one PR:

- Adding an expense starts from the header "+" and then needs a category picked. The category is
  usually the row you're looking at.
- The light theme's near-plan bar is a dark mustard (`#9A7400`). The dark theme's yellow
  (`#F2C94C`) is the one the user wants in both. Docs/design already records this decision for
  brief 105; this brief brings it forward.
- On the Income tab the month's total is small, muted and followed by the word "total", so it's
  easy to miss.
- On the Expenses tab, "€9 over" under a category is in the normal text colour. Only the bar
  shows that something is wrong.
- The Expenses summary card shows Spent and Budget, so you have to work out what's left yourself.

## What

All changes are in the app (`apps/mobile`). The demo re-exports the same screens, so it gets
them too. Nothing changes in the API or the database.

1. **Add from the category row (Expenses tab).**
   - Each category row gets a "+" button at its right end.
   - It opens the add-expense form with that category already picked, the same way the "+" in the
     category screen does (`AddExpenseButton categoryId`).
   - Tapping the rest of the row still opens the category, and long-press still drags the row.
   - The "+" is hidden in ended months, the same rule as the category screen's "+".
   - The "+" in the Expenses header (top right) is removed. The month switcher stays centred.
   - Screen-reader label: "Add expense", which is `AddExpenseButton`'s own label, unchanged
     (decided 2026-11-24 to leave 103b's file alone).
2. **The same yellow in both themes.** Light `caution` changes from `#9A7400` to `#F2C94C`, the
   dark value. This is the near-plan bar (90% of plan up to plan). Dark doesn't change.
3. **Income total (Income tab).**
   - The amount next to the "Income" heading becomes bigger and bold: the same size and face as
     the heading, in the main text colour instead of muted.
   - The word "total" goes, so it reads just "€1,750".
   - Its screen-reader label still says it's the total: "Total €1,750".
4. **"Over" in red (Expenses tab).** When a category's spending in the month is more than
   planned, its "€X over" line uses the theme's `danger` colour in both themes.
5. **Three figures on the Expenses summary card.**
   - The card shows **Spent**, **Remaining** and **Budgeted**, in that order, as three equal
     columns like the Budget tab's strip.
   - Remaining = Budgeted − Spent.
   - Below zero, Remaining shows the negative amount in `danger`, as on the Budget tab.
   - With no budget for the month, Budgeted reads "Not set" and Remaining reads "—".
   - Before the month loads, all three show "—".
   - Screen-reader label: "Spent €X, remaining €Y, budgeted €Z".

## Acceptance criteria

- [ ] Given the Expenses tab in the current month, then every category row has a "+".
      Tapping it opens the add-expense form with that row's category picked.
- [ ] Given the Expenses tab, then there is no "+" in the header, and the month title is still
      centred.
- [ ] Given the Expenses tab on an ended month, then the rows have no "+". Tapping a row still
      opens its category.
- [ ] Given a category row, when I tap outside the "+", then the category screen opens.
      Long-press still starts a drag.
- [ ] Given the light theme and a category at 90–100% of plan, then its bar is `#F2C94C`.
      The dark theme is unchanged.
- [ ] Given a month with income, then the Income heading shows the total with no "total" word,
      bigger than today's caption and in the bold face and main text colour.
- [ ] Given a category spent over plan, then its "€X over" line is in `danger`, in light and
      dark.
- [ ] Given a month with a budget, then the Expenses card shows Spent, Remaining and Budgeted
      with the right amounts. When Spent > Budgeted, Remaining is negative and in `danger`.
- [ ] Given a month with no categories, then Budgeted reads "Not set" and Remaining reads "—".
- [ ] The demo's Expenses and Income tabs show the same changes.

## Out of scope

- The near-plan "€15 left" label and the `cautionText` token from the design spec. These stay
  in brief 105 with the rest of the new palette.
- The violet under-plan bars, Inter, and any other brief 104–106 work.
- The "+" in the category screen. It stays as it is.
- The Statistics tab's over/under line (it is already coloured) and the Budget tab's figures.
- API, MCP connector, database.

## Notes

- **Contrast.** `#F2C94C` on the light track is about 1.3:1, below brief 091's 3:1 rule for
  bars. The design spec (docs/design/design-system.md, "Caution is the same yellow in both
  themes") already accepts this as an exception. The bar is never the only signal: the amounts
  are next to it. Update the comment on `lightColors.caution` and the theme test to match.
- **"Remaining" means two things.** On Budget it is income − budgeted. On Expenses it will be
  budgeted − spent. Each tab's own label is clear in context, so this brief keeps the user's word.
- **The row "+" sits inside the draggable row.** Its press must not open the category or start
  a drag. It needs a 44pt touch target.

## Parallel work: the 103x design-token chain

Brief 103 part 1 (PR #145) is merged. Two more parts are on their way, so this brief has to fit
around them:

- **103b** is written but not built yet. It lives in `~/home/kopiyka-design-tokens-components`,
  branch `chore/design-tokens-components`, from the same `b70a5d4`. It moves 22 shared components
  onto tokens: `AddExpenseButton`, `ReorderList`, `CollapsingSummary`, `CategoryTile`,
  `MonthSwitcher`, `HomeButton` and others. It changes no behaviour or copy.
- **103c** comes after 103b. It covers the remaining screens (category detail, the forms, login
  and others) and `theme.dangerText`.
- **104–106** come later: shared `Card`/`Button`/`IconButton`, the new palette with Inter, and the
  floating tab bar.

To keep merges clean whichever order the PRs land in:

- **Leave 103b's files alone.** Use `AddExpenseButton` exactly as it is, by its `categoryId`
  prop. Don't touch `ReorderList`, `CollapsingSummary`, `CategoryTile`, `MonthSwitcher` or
  `HomeButton`. If the row "+" needs something they don't offer, the plan stops and asks instead
  of editing them.
- **Leave 103c's files alone.** Don't touch `theme.dangerText` or the category, expense or
  income-item screens.
- **Stay within the 103 token rules.** `expenses.tsx` and `income.tsx` are already guarded by
  the lint rule. New styles use `space`, `radius`, `size` and `text` only, with no number
  literals. Use roles that already exist; add no new tokens.
- **The caution colour moves here from 105.** Change the light `caution` value in `theme.ts` and
  update the two places in `docs/design/design-system.md` that say brief 105 makes it. The
  `cautionText` token and the "€15 left" label stay in 105.
- **Version.** Root `package.json` is at 1.17.2. 103b plans 1.17.3. The planner picks the level
  this brief earns under conventions §8b; the number is settled when it merges, since 103b or
  PR #144's line may land first.
- **Snapshots.** This brief changes Expenses and Income on purpose. Whichever of 107 and 103b
  merges second needs fresh "before" snapshots of those two tabs. Say so in the PR.

## Decisions (2026-11-24)

- Three figures: three equal columns, the same look as the Budget tab's strip.
- Income total: the same size and bold face as the "Income" heading (`text.heading` in the
  display font), in the main text colour.

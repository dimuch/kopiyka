# Outcome: Share the category-in-a-month loader

Brief: ./brief.md · Finished 2026-10-18

## PRs

- [#48](https://github.com/dimuch/kopiyka/pull/48) Share the category-in-a-month loader — before versioning

## Decided

- The Category screen, `delete-category` and `planned-amount` share `useCategoryTotals` and `CategoryInMonth` for the
  link check, the spinner, "Category not found." and the loaded view.
- The Category screen keeps its own "That link isn't valid." view, since its header differs and calling the loader
  there would fetch on every valid open.
- A rare race on the Category screen now shows an empty body until the next focus reload; accepted.
- Deviation: slices 1-3 landed as one commit, since widening the hook's return type broke the old loaders.

## Left out

- Changing the Category screen's own month loading, banner or header.
- Equal spinner margins, or a `spinnerStyle` prop.
- A component test setup, and sharing the modals' header, Cancel or busy lock.

## Follow-ups

- 037's rename modal can use the shared loader — done in 040, #55

Full plan: `git show d29b44b3:docs/features/039-category-month-loader/plan.md`

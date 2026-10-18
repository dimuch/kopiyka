# Share the category-in-a-month loader

Type: chore

## Why

Three screens in `apps/mobile` load "one category in one month" almost identically:
`src/app/category/[categoryId].tsx`, `src/app/delete-category.tsx` (its `CategoryLoader`)
and `src/app/planned-amount.tsx` (its `CategoryLoader`, added in PR #47). PR #47's plan and
review deferred extracting it (rule of three) to this chore so #47 stayed small. A fourth
copy is likely with briefs 037/038.

## What

Extract one shared component or hook (the planner's call) that all three screens use for:

- parsing `categoryId` / `month` with `parseIdParam` / `parseMonthParam` and showing
  "That link isn’t valid." for a bad link;
- loading with `useCategoryTotals`, a spinner while loading;
- "Category not found." on `not_found`;
- the Retry `LoadError` ("Couldn’t load this category. Check your connection and try again.")
  on other errors;
- `“<name>” isn’t in <Month>.` when the category isn't in the month.

No visible behaviour change. Known differences between the copies today (the plan decides
how to keep them): the category screen defaults a missing `month` to this month and uses a
24px spinner margin; the two modals use 32px.

## Acceptance criteria

- [ ] All three screens use the shared piece; no screen keeps its own copy of the
      parse/loading/not-found/error/not-in-month branches.
- [ ] Each screen shows the same text and controls as before in its bad-link, loading,
      not-found, load-error (Retry) and not-in-month states.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.
- [ ] Web check at 390×844 of each screen's loading, bad-link, not-found and
      not-in-month states.

## Out of scope

- Changing any copy, layout, or the loaded-state UI of the three screens.
- API changes; changes to `useCategoryTotals` beyond what the extraction needs.
- Other screens that load categories differently (Budget tab, Expenses).

## Notes

- Brief 037 (rename a category in one month) runs in parallel and may touch the Category
  screen's name display. Keep this change to the shared loader and its three call sites.

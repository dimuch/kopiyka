# Add expense's quick categories follow my order

Type: feature

## Why

Brief 092 gave each member their own category order, and Budget, Expenses, Home and the expense form's "More" sheet
follow it. The five quick tiles at the top of Add expense don't: the API picks them by the ledger's most recent expense
(anyone's), with never-used ones in the ledger order (`pickQuick`, `apps/api/src/categories/routes.ts`). So the
categories I use most, which I've dragged to the top, can still sit behind "More", and the tiles shuffle whenever
someone adds an expense. I want my top categories always one tap away.

## What

- **The quick tiles are the first five categories of the month in my order**, in that order. Nothing about recent
  expenses decides them any more.
- **The form's default category** (when it isn't opened on a category or an expense) is the first quick tile, so my #1.
- **"More" shows the rest**, in my order, as today.
- Opening the form on a category that isn't in my top five still puts it in the quick row (today's `withQuick`
  behaviour: it takes the last spot), so the selection always shows.
- Until I reorder, my order is the ledger order (as in 092), so the tiles are the ledger's first five.
- Each member sees their own tiles on a shared ledger.
- Reordering on Budget or Expenses changes the tiles the next time the form loads its categories.
- Same in the demo build.

## Acceptance criteria

- [ ] API: `GET /api/ledgers/:id/categories?month=` returns `quickCategoryIds` = the first five of `categories` (the
      caller's order), or all of them when the month has fewer. Unit test of the picking; integration test where two
      members of one ledger with different orders get different `quickCategoryIds`, and a newer expense in a
      category outside the top five doesn't put it in.
- [ ] App, web at phone width: after dragging a category to the top on Budget, opening Add expense shows it as the
      first quick tile and selected by default; the other tiles follow my order; "More" holds the rest in my order.
- [ ] App: opening Add expense from a category outside my top five shows it selected in the quick row.
- [ ] Demo build follows the same rule.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Changing the number of quick tiles (stays five) or the tiles' look.
- Any "recently used" or "most used" ordering, or combining it with my order.
- Reordering from the expense form itself.
- The MCP connector's behaviour, unless it reads `quickCategoryIds` (then it simply gets the new ids).

## Notes

- This reverses 092's decision that the quick row is "by most recently used … the same for every member"
  (092 brief, Out of scope; `pickQuick`'s comment). The user chose my order over recently used.
- The list query already returns rows in the caller's order (`IN_MY_ORDER`), so the API may be able to take the first
  five of what it returns; the `last_used_at` join may then be unused. Planner checks every reader of
  `quickCategoryIds` / `pickQuick` (app, demo store, MCP, docs) before deciding where the change lives.

# Income tab

Type: feature

Part 2 of 3 of ledger income. Design: `../058-ledger-income/plan.md`, "Part 2" (slices 2.1–2.5); plan this brief
from ../058-ledger-income/plan.md, Part 2. It builds on 058's income API.

## Why

The budget is what the ledger plans to spend, but nothing says what it can spend. The plan is limited by what its
members earn that month. 058 stores each month's income; members need a place in the app to enter and see it.

## What

- **Income tab:** a new tab next to Budget, working like it: a month switcher, the month's items with who added each,
  the month's total income, add an item, edit an item's title and amount, delete an item.
- **Every member edits everything:** owner and invited members alike can see, add, edit and delete any income item
  of the ledger, not only their own.
- **Copy last month:** a month with no income items can be filled from the previous month's items. Unlike the Budget
  copy, titles **and amounts** are kept, since income usually repeats.
- Ended months can't change, the same as planned amounts.

## Acceptance criteria

- [ ] App (web 390×844): the Income tab lists, adds, edits and deletes items and shows the total.
- [ ] iPhone (Expo Go): the Income tab works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- The over-income rule, its message and the Budget limit (060).
- Income in currencies other than EUR.
- Recurring income that fills months automatically (the copy is manual).
- Received vs expected income, and comparing income with actual expenses.
- Notion sync of income.

## Notes

- Money stays decimal strings / integer cents per the conventions, never floats.
- 060 (the rule) ships only after this brief is live, so members can add income before raises are refused.

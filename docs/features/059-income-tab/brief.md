# Income tab

Type: feature

Part 1 of 2 of the Income tab: this brief lists and adds income; 061 (edit, delete and copy) comes next. Design:
./plan.md, slices 1–5.

Part 2 of 3 of ledger income; builds on 058's income API.

## Why

The budget is what the ledger plans to spend, but nothing says what it can spend. The plan is limited by what its
members earn that month. 058 stores each month's income; members need a place in the app to enter and see it.

## What

- **Income tab:** a new tab next to Budget, working like it: a month switcher, the month's items with who added each,
  the month's total income, add an item.
- **Every member adds:** owner and invited members alike can see any income item of the ledger and add items.
- Ended months can't change, the same as planned amounts.

## Acceptance criteria

- [ ] App (web 390×844): the Income tab lists and adds items and shows the total.
- [ ] iPhone (Expo Go): the Income tab works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Editing and deleting an item, and copying last month's items (061).
- The over-income rule, its message and the Budget limit (060).
- Income in currencies other than EUR.
- Recurring income that fills months automatically.
- Received vs expected income, and comparing income with actual expenses.
- Notion sync of income.

## Notes

- Money stays decimal strings / integer cents per the conventions, never floats.
- 060 (the rule) ships only after 061 is live, so members can add, edit and delete income before raises are refused.

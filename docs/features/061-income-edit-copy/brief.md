# Edit, delete and copy income

Type: feature

Part 2 of 2 of the Income tab, after 059. Design: `../059-income-tab/plan.md`, slices 6–8; plan this brief from
../059-income-tab/plan.md, slices 6–8. It builds on 059's Income tab and 058's income API. 060 (the over-income rule)
ships only after this brief is live: 060's message changes the edit and delete screens added here.

## Why

The budget is what the ledger plans to spend, but nothing says what it can spend. The plan is limited by what its
members earn that month. 059 lets members see and add a month's income; they also need to correct it, remove it, and
fill a new month without typing it all again.

## What

- **Income tab:** edit an item's title and amount, delete an item.
- **Every member edits everything:** owner and invited members alike can see, add, edit and delete any income item
  of the ledger, not only their own.
- **Copy last month:** a month with no income items can be filled from the previous month's items. Unlike the Budget
  copy, titles **and amounts** are kept, since income usually repeats.
- Ended months can't change, the same as planned amounts.

## Acceptance criteria

- [ ] App (web 390×844): the Income tab edits and deletes items and copies last month's items into an empty month.
- [ ] iPhone (Expo Go): editing, deleting and copying on the Income tab work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- The over-income rule, its message and the Budget limit (060).
- Income in currencies other than EUR.
- Recurring income that fills months automatically (the copy is manual).
- Received vs expected income, and comparing income with actual expenses.
- Notion sync of income.

## Notes

- Money stays decimal strings / integer cents per the conventions, never floats.
- 060 (the rule) ships only after this brief is live, so members can add, edit and delete income before raises are
  refused.

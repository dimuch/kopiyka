# Ledger income per month

Type: feature

Part 1 of 3 of ledger income. Design: ./plan.md

## Why

The budget is what the ledger plans to spend, but nothing says what it can spend. The plan is limited by what its
members earn that month. Today a member can plan any total, so a month can be planned above the household's income
without anyone noticing.

## What

- **Income items:** each item belongs to a ledger and a `YYYY-MM` month. It has a title ("Salary", "Freelance"), an
  amount in EUR (> 0, cents allowed) and the member who added it. A month can have any number of items, from any
  member.
- **Income tab:** a new tab next to Budget, working like it: a month switcher, the month's items with who added each,
  the month's total income, add an item, edit an item's title and amount, delete an item.
- **Every member edits everything:** owner and invited members alike can see, add, edit and delete any income item
  of the ledger, not only their own.
- **Copy last month:** a month with no income items can be filled from the previous month's items. Unlike the Budget
  copy, titles **and amounts** are kept, since income usually repeats.
- **Budget shows the limit:** the Budget tab shows the month's income, planned total and what is left to plan
  (income − planned), red when negative.
- **The rule (strict), for months from `2026-11` on:** a month's planned total (sum of `category_budgets.planned_eur`
  over its live categories) must never exceed its income total. The API refuses every change that would end with
  planned > income:
  - setting a planned amount higher;
  - Undo of a category Remove or a category delete that brings a planned amount back;
  - lowering an income item's amount, or deleting an item.
- Changes that move a month toward the limit are always allowed, even when it is already over (lowering a planned
  amount, removing a category, adding or raising income). So a month that is over today (for example November 2026,
  planned before this feature) can be fixed in either direction, but no one can plan more until income covers it.
- Months before `2026-11` are not checked: their budgets stay as they are, and income may be added to them without
  any rule.
- Ended months can't change, the same as planned amounts.

## Acceptance criteria

- [ ] API: list, add, edit and delete income items for a month, with integration tests: happy path, 400 for an empty
      title or an amount ≤ 0 or malformed, 404 for an unknown or foreign item, 409 `month_ended`, 401, non-member 404.
- [ ] API: any member (not only the one who added it) can edit and delete an item.
- [ ] API: copy last month's income copies titles and amounts. It is refused when the month already has items or the
      previous month has none.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Income in currencies other than EUR.
- Recurring income that fills months automatically (the copy is manual).
- Received vs expected income, and comparing income with actual expenses.
- Notion sync of income.
- The Income tab (`../059-income-tab/brief.md`) and the rule with the Budget limit
  (`../060-income-limit/brief.md`).

## Notes

- Money stays decimal strings / integer cents per the conventions, never floats.
- The rule's start month `2026-11` is a constant in the API, not per ledger.
- Today (2026-11-02) November budgets may already be planned with no income. Under the rule they are over until
  members add income, which is intended.

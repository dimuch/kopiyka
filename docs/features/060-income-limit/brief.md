# Planned never above income

Type: feature

Part 3 of 3 of ledger income. Design: `../058-ledger-income/plan.md`, "Part 3" (slices 3.1–3.5); plan this brief
from ../058-ledger-income/plan.md, Part 3. It ships only after 059 (the Income tab) is live: otherwise a month planned
with no income, like November 2026, refuses every raise and nobody can add income to fix it.

## Why

Today a member can plan any total, so a month can be planned above the household's income without anyone noticing.
058 and 059 record each month's income; the plan should be limited by it.

## What

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

## Acceptance criteria

- [ ] API: for a month ≥ `2026-11`, each change listed under "The rule" returns 409 `over_income` when it would leave
      planned > income, and writes nothing. The same change succeeds when it stays within income (equal is allowed).
- [ ] API: lowering a planned amount, removing a category and adding income succeed in a month that is already over.
- [ ] API: a month before `2026-11` accepts planned amounts above its income.
- [ ] API: the check holds under concurrent writes (two members raising plans or lowering income at once can't
      together end above income).
- [ ] App (web 390×844): a refused change shows a clear message ("Planned would exceed income by €X"); Budget shows
      income / planned / left to plan.
- [ ] Unit tests for the amount parsing and the rule's arithmetic (cents, no floats).
- [ ] iPhone (Expo Go): the over-income message works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Income in currencies other than EUR.
- Recurring income that fills months automatically (the copy is manual).
- Received vs expected income, and comparing income with actual expenses.
- Notion sync of income.

## Notes

- Money stays decimal strings / integer cents per the conventions, never floats.
- The rule's start month `2026-11` is a constant in the API, not per ledger.
- Today (2026-11-02) November budgets may already be planned with no income. Under the rule they are over until
  members add income, which is intended.

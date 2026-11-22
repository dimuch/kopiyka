# Budget figure labels: Budgeted and Remaining

Type: chore

## Why

The figures strip at the top of the Budget tab reads "Income · Planned · Left to plan".
"Budgeted" and "Remaining" are shorter and say the same thing in plainer words.

## What

On the Budget tab, the strip under the month (`IncomeFigures` in
`apps/mobile/src/app/(tabs)/budget.tsx`) shows:

- "Planned" → **"Budgeted"**
- "Left to plan" → **"Remaining"**

"Income" stays as it is. The screen-reader label of the strip uses the same words:
"Income €X, budgeted €Y, remaining €Z". The amounts, and the danger colour when
Remaining goes below zero, don't change.

## Acceptance criteria

- [ ] Given a month with income and planned categories, when I open the Budget tab, then
      the strip shows "Income", "Budgeted" and "Remaining" with the same amounts as before.
- [ ] Given income below the planned total, then "Remaining" shows the negative amount in
      the danger colour, as "Left to plan" did.
- [ ] The strip's accessibility label reads "Income …, budgeted …, remaining …".

## Out of scope

- Other uses of "planned": the "€X planned" caption over the Categories list, the
  category row's screen-reader text and hint, the "Planned amount" field in the category
  form, the Expenses and Statistics tabs, the over-income error ("Planned would exceed
  income"), the MCP connector and the API.
- Renaming code identifiers (`plannedCents`, `left`, …).

## Notes

- Copy-only change in one component; there's no logic to add.

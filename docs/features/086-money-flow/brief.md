# See a month's money flow in Statistics

Type: feature

Status: future — not planned yet. Depends on brief 085 (each month's opening and closing balance).

## Why

Kopiyka shows numbers per category, but not the story of a month's money: where it started, what came in, where it
went, and what was left. Notion's Netto calculator gave a rough version of that; kopiyka should do it better, as a
picture you can explore rather than a table of numbers.

## What

A money-flow chart in the Statistics tab, for one month at a time (the user's idea, 2026-11-08):

- The chart starts at **0** (or the month's opening balance from brief 085) and steps up with the month's **total
  income**.
- Tapping the income total offers three views:
  1. **Income by source:** the total split into its parts (salary, other income items, per member).
  2. **Where it went:** how the income was distributed over the month — by category (planned vs spent) and over time
     (day by day or week by week), down to what was left.
  3. **End of month:** the closing amount and the possible saving, which can be negative (overspent), compared with
     the opening.
- A smart representation, not just figures: for example a waterfall or Sankey-style flow (income → categories →
  left over), colour for over/under plan, and short plain-language highlights ("You spent 12% more on food than
  planned", "This month saved €140").
- Works for past months (Jan–Oct 2026 from the Notion imports) and the months entered in the app.

## Acceptance criteria

To be written when this brief is picked up. Each view above needs a testable outcome (numbers add up to the month's
income, spent and closing figures; a negative saving shows as negative).

## Out of scope (for now)

- Multi-month or yearly trends (could be a later brief).
- Forecasting.

## Notes

- Data available: income items (brief 058, from November; Jan–Oct income is still only in Notion's Income table —
  importing it may be a prerequisite), category plans and expenses (Jan–Oct from brief 049), opening/closing (brief
  085).
- Charting on Expo (iOS + web) needs a library choice; decide in the plan.

## Open questions

- Should Jan–Oct income be imported from Notion's Income table first, so the flow works for those months?
- Start point: always 0, or the month's opening balance (carry-over)?
- Chart type for "where it went": waterfall, Sankey, stacked bar?

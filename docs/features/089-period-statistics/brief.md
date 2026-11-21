# See a period's totals in Statistics

Type: feature

Depends on brief 088 (January–October income), so periods before November show their income.

## Why

Home and every tab show one month at a time, so there is no way to see how the last three months, half a year or the
year went: what came in, what was planned, what was spent and what was left. The Statistics tab is still a
placeholder. It should answer "how did this period go?" for any period the user picks (the user's idea, 2026-11-21).

## What

The Statistics tab shows the open ledger's totals for a chosen period. Home stays on the current month.

- **Period picker** at the top, one choice at a time; **Current month** is selected when the tab opens:
  - **Current month**: the current Kyiv month, with its data so far (the month is not finished).
  - **Previous month**
  - **Last 3 months**, **Last 6 months**, **Last 12 months**: the current month and the 2, 5 or 11 months before it.
  - **This year**: January to the current month.
  - **Custom**: a from-month and a to-month (whole months; from ≤ to; at most 24 months).
- The current month is always counted with its data so far, never left out or estimated.
- The selected period is shown in words under the picker ("Sept – Nov 2026").
- **Totals** for the period, in EUR: income, planned, spent, and left (income − spent, red when negative).
- **By category:** each category with its planned and spent for the period, and how far over or under plan it is,
  sorted by spent, largest first.
- **By month** (when the period has more than one month): one row per month with its income, spent and left, oldest
  first. A month with no data shows zeros.
- **One ledger:** the figures are the open ledger's, all members together, whichever ledger the user has open. No
  per-member split.
- **Deleted data is left out:** a deleted category, its expenses and any deleted expense count nowhere, as in the
  month views.
- Loading, empty and error states like the other tabs (brief 066 components); works on iOS and web.
- **API:** one read-only endpoint, `GET /api/ledgers/:id/summary?from=YYYY-MM&to=YYYY-MM`, that adds the figures up on
  the server and returns the totals, the categories and the months. Any member of the ledger may call it. The app
  works out `from` and `to` for each choice.

## Acceptance criteria

- [ ] Integration test: the summary for one month matches that month's income total, planned total and spent total as
      the month endpoints return them.
- [ ] Integration test: a three-month summary's totals are the sums of its months; its categories and months add up
      to the totals.
- [ ] Integration test: a deleted category's plan and expenses and a deleted expense are not counted.
- [ ] Integration test: another ledger's data is never counted, and a user outside the ledger gets the same refusal as
      for the other ledger routes.
- [ ] Integration test: 400 for a bad month, `from` after `to`, or more than 24 months.
- [ ] Unit test (app): each choice gives the right `from`/`to` for a fixed date, including January (Previous month is
      last December; This year is one month) and a Kyiv-midnight edge.
- [ ] App: switching the period reloads the figures; left is red when negative; a single-month period shows no
      month rows.
- [ ] Checked on iPhone and web: Current month matches Home's figures; This year shows January–October income from
      the 088 import.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Charts and the money-flow view (brief 086, which can build on this endpoint).
- Opening and closing balances (brief 085's numbers).
- Day-level ranges; per-member figures; comparing with the previous period; forecasts.
- Remembering the chosen period between visits.
- Tapping a category or month to drill into its expenses.
- An MCP connector tool for the summary.

## Notes

- Money is summed in cents on the server (`apps/api/src/money.ts`), and dates follow `apps/api/src/dates.ts` and the
  Kyiv month rules in the conventions skill.
- Planned and income are per month, so a period's planned and income are the sums of its months.
- No new UI library: the picker can be a row of chips and two month fields built from the existing components.
- If the plan comes out much above ~400 changed lines, split it into two PRs: the endpoint first, then the screen.

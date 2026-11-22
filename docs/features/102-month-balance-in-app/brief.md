# Work out each month's start and end balance in the app

Type: feature

## Why

The Budget tab's `Start → End` line (brief 090) only shows for months with a row imported from Notion (brief 085):
January–October 2026. From November on there is no line, because nothing in kopiyka produces those numbers; Notion did,
with hand-typed "Actual Closing" balances. The user is detaching kopiyka from Notion, so the app has to work out each
month's start and end itself, and let the user correct the end when real money moved outside the app (a transfer to
savings, a bank correction).

## What

- **Carry over (user's decision, 2026-11-22):**
  - A month's **Start** is the previous month's **End**.
  - A month's **End** is its Start + the month's income (every member's income items) − the month's spent (all live
    expenses dated in that month).
  - The current month's End is "so far": it changes as income and expenses are added, edited or deleted.
- **Imported months stay as they are (user's decision):** January–October 2026, the rows from Notion, keep their
  stored start and end. The rule applies from the month after the last stored month. November 2026 starts at October's
  stored end (−€35 for ledger 1 today).
- **Actual End, set by hand (user's decision):** on the Budget tab the user can set a month's real end balance, like
  Notion's Actual Closing, and clear it again.
  - While a month has an actual End, the line shows that, not the computed one, and the next month starts from it.
  - Clearing it goes back to the computed End.
  - Amounts are EUR, signed (a negative end is money short), with up to 2 decimals.
- **Which months show the line:**
  - Every month from the ledger's first month with a budget (a category list) up to the current month.
  - A ledger that never imported balances starts its first budgeted month at €0.
  - Months after the current one show no line. So do months before the ledger's first budgeted month.
- **Shared ledger:** the numbers are the ledger's, the same for every member. Any member can set or clear an actual End.
- **Ended months:** an actual End can be set or cleared in any month up to the current one, ended ones included; it's
  a correction of history, not month data the lock protects.
- **Demo build:** the demo store follows the same rules (no imported months; its first budgeted month starts at €0),
  so the demo shows the line too.

## Acceptance criteria

- [ ] API: for ledger 1's data, November's balance is Start −€35 and End −€35 + November's income − November's spent.
      December starts at November's End. Integration tests cover: a month after an imported one, a chain of computed
      months, the current month changing after an expense is added, edited and deleted, and an income item added.
- [ ] API: an imported month (Jan–Oct) returns its stored numbers unchanged, even when income or expenses for it
      change.
- [ ] API: setting an actual End for a month makes the line show it and the next month start from it; clearing it
      goes back to the computed End. Integration tests, including an ended month, a non-member (404), signed out
      (401), a malformed amount (400) and a month after the current one (refused).
- [ ] API: a ledger with no imported balances starts its first budgeted month at €0; a month before its first budget,
      or after the current month, has no balance.
- [ ] App: the Budget tab shows the line for November 2026 on ledger 1. Setting an actual End from the Budget tab
      updates the line and the next month's Start, and clearing it reverts. A failed save says so and changes nothing.
- [ ] Demo: the demo store computes the same way (tests), and the demo's Budget tab shows the line.
- [ ] Browser check at phone width (~390×844), web: November and December on ledger 1, set and clear an actual End,
      light and dark mode. iPhone (Expo Go): the line and setting an actual End.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Removing the Notion sync and import code (Sync to Notion, `notion-start`, `import-history`, `import-balances`,
  `import-income`): its own brief later (user's decision, 2026-11-22).
- Changing a month's Start by hand: Start always follows the previous month's End.
- Recomputing January–October.
- The money-flow view (brief 086), and showing balances anywhere but the Budget tab's line (Home, Statistics, the MCP
  connector).
- Per-account balances (Notion's `Account` rows): kopiyka keeps one number per month.
- Forecasting future months from planned amounts.

## Notes

- Data today: `month_balances (ledger_id, balance_month, opening_eur, closing_eur)` holds the imported rows (migration
  016). Laptop ledger 1 has Jan–Oct 2026; production ledger 1 the same. Income is in `income_items` (per ledger and
  month), and expenses in `expenses` with `deleted_at`.
- Read route today: `GET /api/ledgers/:id/months/:month/balance` → `{ balance: { openingEur, closingEur } | null }`
  (`apps/api/src/balances/routes.ts`); the app shows it with `balanceLine` / `useMonthBalance`. The demo store answers
  it with `null`.
- Checked 2026-11-22 on ledger 1: Notion's closings don't follow any one formula (January equals Start + income −
  spent; Feb, Mar and May equal that month's income − spent; Jun and Sep were set to 0), which is why the imported
  months stay as stored.
- Money is decimal strings on the wire and integer cents in logic (conventions).

## Open questions

- Wording and place of the "set actual End" control (e.g. tap the line → a small form). Assumed: tapping the line
  opens a form with the amount and a "Use calculated" action; the planner proposes the details.

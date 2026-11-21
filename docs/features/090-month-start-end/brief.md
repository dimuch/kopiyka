# Show a month's start and end balance on the Budget tab

Type: feature

## Why

Brief 085 imported each month's opening and closing balance (January–October 2026) from Notion into
`month_balances`, on the laptop and in production, but nothing in the app reads it. To see how a month started and
ended you have to query the database. A one-line view on the Budget tab makes the numbers visible now, before the
bigger money-flow view (brief 086) is built.

## What

- **Budget tab, month header:** under the month switcher, one line: `Start −€180 → End −€52` for the month
  shown. Amounts use the app's usual EUR format (`eur`: no `.00` for whole euros, cents when there are some, e.g. `−€50.25`); a negative amount shows its minus sign (user's decision, 2026-11-21).
- **Only when the month has balances:** a month without a stored row (November 2026 on, or any month of a ledger that
  never imported) shows no line and no placeholder. Switching months updates the line.
- **Read-only API:** a route that returns one month's opening and closing balance for a ledger the signed-in user is
  a member of, or "none" for a month without a row. The same membership rules as the ledger's other month routes.
- **Loading and errors:** the line never blocks the rest of the Budget tab. While it loads, nothing shows; if it
  fails, the line is left out (the rest of the tab works as today).
- **Demo build:** the demo store answers the new route with "none", so the demo shows no line (no invented balances).

## Acceptance criteria

- [ ] API integration test: a member gets `{ opening, closing }` for a month with a row (`-180.00`, `-52.00`
      strings), "none" for a month without one, 404 for a ledger they aren't a member of, 401 without a session, and
      400 for a malformed month.
- [ ] App test: the line renders `Start −€180 → End −€52` for a month with balances and nothing for "none" or
      an error.
- [ ] Demo: the demo store answers the route with "none" (test), so the demo's Budget tab renders without errors.
- [ ] Browser check at phone width (~390×844), web: ledger 1 on the laptop, January shows `Start €0 → End −€180`,
      October `Start €0 → End −€35`, November no line; light and dark mode; screenshot in the PR.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Editing balances in the app; any write route.
- The money-flow chart, income breakdown, savings (brief 086).
- Importing income from Notion (brief 088, another session).
- Showing balances anywhere else (Home, Statistics, the MCP connector).
- Computing a balance for months without an imported row (November on).

## Notes

- Data: `month_balances (ledger_id, balance_month DATE, opening_eur, closing_eur)` — signed DECIMAL(12,2), both NOT
  NULL (migration 016, brief 085). Laptop and production ledger 1 hold Jan–Oct 2026.
- The demo store (`apps/mobile/src/demo/store.ts`) fails loudly on an unknown route, so it needs the new route.
- Use `@/components/Pressable` / `TextField` conventions only if the line becomes interactive (it shouldn't).

## Open questions

- Wording: "Start → End" (as asked) vs "Opening → Closing". Assumed: "Start → End".
- Decided (user, 2026-11-21): amounts in the app's usual `eur` format, without `.00` for whole euros.

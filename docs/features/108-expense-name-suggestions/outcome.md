# Outcome: Expense name suggestions per category

Brief: ./brief.md · Finished 2026-11-24

## PRs

- [#150](https://github.com/dimuch/kopiyka/pull/150) Suggest earlier expense names on the expense form — v1.20.0 (via #148)
- [#148](https://github.com/dimuch/kopiyka/pull/148) Suggest expense names already used in the category — v1.20.0

## Decided

- At Gate A the brief split in two: the API route, then the app and demo stacked on it. #150 was merged into #148's
  branch, so #148 shipped both halves.
- `GET /api/ledgers/:id/expenses/names` reads one category's names over this month and last. A pure `rankNames`
  groups them in code, not SQL, because the database collation is also accent-insensitive.
- The app filters as you type (case-insensitive, anywhere in the name, at most 20), so typing makes no request.
- Loading or failed suggestions show nothing, with no error or retry; free text always works.
- Options use `tabIndex={-1}` on web, since react-native-web ignored `focusable={false}`.
- A later fix, #162 (v1.23.5), floated the list over the form instead of pushing it down.

## Left out

- Amount suggestions, suggestions on the income form or across categories, and the MCP connector.
- A server-side filter, a client cache, an error state, or removing a name from the list.

## Follow-ups

None.

Full plan: `git show 09658886:docs/features/108-expense-name-suggestions/plan.md`

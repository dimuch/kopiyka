# Expenses summary: the same figure order as Budget

Type: fix

## Why

The summary cards at the top of the Budget and Expenses tabs show three figures each, but in a different order:

- Budget: **Income · Budgeted · Remaining**
- Expenses: **Spent · Remaining · Budgeted**

Switching between the tabs, Budgeted and Remaining swap places, so the eye has to look for them again. Budget's
order reads left to right as a sum (what you have, what you take off it, what is left), and Expenses should read
the same way.

## What

Only the Expenses tab's summary card changes, in the app (`apps/mobile`). The demo re-exports the same screen, so
it gets it too. Nothing changes in the API, the database or the Budget tab.

1. The card's figures become **Spent · Budgeted · Remaining**: Spent at the left edge, Budgeted centred,
   Remaining at the right edge, the same layout as Budget's card.
2. Remaining keeps its red colour when spending is over the plan, now in the right-hand slot.
3. The screen reader label follows the new order: "Spent €250.50, budgeted €1,000, remaining €749.50".
   A month without categories keeps "Spent €0, budget not set".
4. A month without categories still shows Budgeted as "Not set" and Remaining as "—", in their new slots.

## Acceptance criteria

- [ ] Given a month with categories, when the Expenses tab opens, then the card reads Spent, Budgeted, Remaining
      from left to right, with the same alignment (left, centre, right) as the Budget tab's card.
- [ ] Given spending over the plan, then Remaining (now on the right) is in the danger colour and the other two
      are not.
- [ ] Given a month without categories, then the card shows Spent, "Not set", "—" in that order.
- [ ] `spendingFigures`' label lists spent, budgeted, remaining in that order; `monthSummary.test.ts` expects it.
- [ ] The comments in `expenses.tsx` and `monthSummary.ts` that describe the order match the new one.
- [ ] Checked on the iPhone (Expo Go) and on the web, light and dark.

## Out of scope

- The Budget tab's card: its order is the reference and stays as it is.
- Renaming any figure (for example "Budgeted" vs "Budget"), changing the amounts or how Remaining is worked out.
- Sharing one summary-card component between the two tabs. Worth a look in the consolidation pass if the two
  blocks now differ only in their data, but not required.

## Notes

- Expenses card: `apps/mobile/src/app/(tabs)/expenses.tsx` (the figures array and the `figures` style comment).
- Budget card for reference: `IncomeFigures` in `apps/mobile/src/app/(tabs)/budget.tsx`.
- Label: `spendingFigures` in `apps/mobile/src/data/monthSummary.ts`, tested in
  `apps/mobile/test/monthSummary.test.ts`.
- Reference screenshot (Budget): Income €1,750 · Budgeted €1,400 · Remaining €350.
- A user-visible change, so a patch or minor version bump per conventions §8b.

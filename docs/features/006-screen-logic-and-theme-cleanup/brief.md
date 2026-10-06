# Screen logic and theme cleanup

Type: chore

## Why

After 003–005 the screens are correct but still hold pure logic inline. Spent per category,
grouping by day, the same `toCents` sum four times and the quick/more category split live in
`app/index.tsx:19-26`, `app/category/[categoryId].tsx:46-57` and `app/expense.tsx:51-54,139-141`,
so they can't be unit-tested once the app has a runner (conventions §2, §6). Smaller drift rides
along:

- About 13 raw hex colours sit outside `theme.ts`.
- Two `{x && …}` renders use a number or string (`expense.tsx:353`,
  `CollapsingSummary.tsx:57`), which is a must under §8a `rendering-no-falsy-and`.
- `CollapsingSummary` re-creates its native scroll handler every render.
- A few exports and props are unused.

Audit: `docs/audits/2026-10-architecture.md` M9, M10, M12, M13, M21, M22.

## What

- `data/monthSummary.ts`: `sumCents(expenses, field)`, `spentByCategory(expenses)`,
  `groupByDay(expenses)` (date-desc order kept, with per-day totals). Screens use them.
- `data/quick.ts`: `withQuick` and the quick/more split; the expense screen uses them.
- `theme.ts` gains named tokens for every raw colour now in screens and components, and no
  `#rrggbb` remains outside `theme.ts`.
- Conditional renders use explicit booleans or ternaries. `expenseId` params are parsed with
  `Number.isInteger`, and an invalid one is treated as "add".
- `useCollapsingSummary` memoises its `Animated.event` and interpolations.
- Removed: the unused `API_URL` export, the `sliders` icon, the `IconName` export, `ledgers` in
  auth state, and the unreferenced `nativeID`s. Alternatively the `nativeID`s get wired to
  `aria-labelledby`; the plan picks one.

## Acceptance criteria

- [ ] `grep -rnE "#[0-9A-Fa-f]{6}" apps/mobile/src --include=*.tsx` returns nothing outside `theme.ts`;
      screens look the same (before/after screenshots of Home, Category and Expense at phone width).
- [ ] `grep -rn "toCents(e\.amount" apps/mobile/src/app` returns nothing; totals on Home and
      Category match before/after for the same month.
- [ ] `/expense?expenseId=abc` on web renders the Add form with no stray `NaN` text.
- [ ] No `{<number or string> && <JSX>}` patterns remain in `apps/mobile/src` (code review).
- [ ] Every symbol removed in this brief has no importer left; `yarn lint typecheck` green.
- [ ] Behaviour is unchanged otherwise. The PR is refactor-only, apart from the `NaN` fix.

## Out of scope

- Adding an app test runner. That's a natural next brief now that the logic lives in
  `format.ts` and `data/`.
- Splitting presentational components out of `expense.tsx` beyond what 004 did.
- A `KeyboardAvoid` wrapper (audit M23), the `AuthContext` robustness fixes (M18).
- Visual redesign or new theme values.

## Notes

- Builds on 005 (the screens' data and error paths are settled, so this is a pure move).

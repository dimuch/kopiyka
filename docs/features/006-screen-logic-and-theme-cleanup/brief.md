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
- `data/quick.ts`: `withQuick` (moved from `data/useExpenseDraft.ts`) and the quick/more split (`splitQuick`).
- `theme.ts` gains named tokens for every raw colour now in screens and components, and no
  `#rrggbb` remains outside `theme.ts`.
- Conditional renders use explicit booleans or ternaries: `error` and `added` in `expense.tsx`, `error` in
  `login.tsx`, `label` in `CollapsingSummary`.
- `useCollapsingSummary` memoises its `Animated.event` and interpolations.
- Removed: the unused `API_URL` export, the `sliders` icon, the `IconName` export, `ledgers` in
  auth state, and the unreferenced `nativeID`s (inputs keep their `accessibilityLabel`).

## Acceptance criteria

- [ ] `rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" apps/mobile/src -g '!theme.ts'` returns nothing; screens look the same
      (before/after screenshots at 390×844 of Home, Category with the Undo toast, Add/Edit with the "Added" note, the
      category sheet and Login).
- [ ] `rg -n "\+ toCents\(" apps/mobile/src/app` returns nothing; totals on Home and Category match before/after for
      the same month.
- [ ] `/expense?expenseId=abc` on web shows "That link isn’t valid." with Back and no stray `NaN` text (004's
      behaviour, unchanged).
- [ ] No `{<number or string> && <JSX>}` patterns remain in `apps/mobile/src` (`rg` + code review).
- [ ] Every symbol removed in this brief has no importer left; `yarn lint typecheck` green.
- [ ] Behaviour is unchanged. The PR is refactor-only.

## Out of scope

- Adding an app test runner. That's a natural next brief now that the logic lives in
  `format.ts` and `data/`.
- Splitting presentational components out of `expense.tsx` beyond what 004 did.
- A `KeyboardAvoid` wrapper (audit M23), the `AuthContext` robustness fixes (M18).
- Visual redesign or new theme values.

## Notes

- Builds on 005 (the screens' data and error paths are settled, so this is a pure move).
- Amended at Gate A (2026-10-08): the brief predates briefs 003–008. The "invalid id → add" item is dropped (004
  made `?expenseId=abc` show "That link isn’t valid."), the totals grep is narrowed to sums, and the What/ACs name
  today's locations.

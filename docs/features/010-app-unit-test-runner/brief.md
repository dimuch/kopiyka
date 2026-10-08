# App unit test runner

Type: chore

## Why

The app has no test runner (conventions §6), so its pure logic is only checked by clicking through the web build.
Briefs 003–006 moved that logic out of screens on purpose, so it can be tested: money and date helpers in
`apps/mobile/src/format.ts`, month totals and day grouping in `data/monthSummary.ts`, the quick-row rules in
`data/quick.ts`, and (after brief 009) the link-param parsers. Several of these are exactly where bugs were found
during the audit (Kyiv dates around midnight and DST, rounding, the quick row). The API already uses Vitest 4.

## What

- Vitest runs the app's unit tests for pure modules, with the same setup style as the API (`vitest run`, a small
  `vitest.config.ts`, tests under `apps/mobile/test/`).
- `yarn test` at the root runs both the API and the app tests, so CI (which already runs `yarn test`) covers the app
  with no workflow change.
- First tests cover the existing pure modules:
  - `format.ts`: amount parsing and normalising (`toCents`, `normalizeAmount`), `eur`/`uah` formatting, `kyivToday`
    and `kyivMonth` around Kyiv midnight and the DST switches, `addDays` across month/year ends, `shiftMonth` across
    year ends, `monthName`/`monthLabel`/`dayLabel`/`shortDate`, and the conversions (`convertPreview`, `centsToInput`,
    `otherAmountText`).
  - `data/monthSummary.ts`: `spentByCategory`, `groupByDay` (order), `sumCents`.
  - `data/quick.ts`: `withQuick` (already present, new id, row full) and `splitQuick`.
  - The link-param parsers from 009, if 009 has merged.
- Conventions §6 "App" is updated: Vitest for pure modules in `format.ts`/`data/`; UI is still verified in the web build
  and on iPhone.

## Acceptance criteria

- [ ] `yarn mobile test` runs the app tests and exits non-zero when one fails (checked by temporarily breaking one).
- [ ] Root `yarn test` runs the API and app tests; CI is green on the PR without editing `.github/workflows`.
- [ ] Tests exist for every exported function in `format.ts`, `data/monthSummary.ts` and `data/quick.ts`, using table
      cases in the style of the API's `money.test.ts`, with a fixed clock where time matters.
- [ ] Tests import the modules as the app does (the `@/` alias works) and need no React Native or Expo runtime.
- [ ] `yarn format:check && yarn lint && yarn typecheck` green; the test files are linted and type-checked too.
- [ ] Conventions §6 "App" bullet updated.

## Out of scope

- Component or screen tests (React Native Testing Library, jsdom), snapshots, and E2E.
- Testing the data hooks (`useMonth`, `useExpenseDraft`, `useRate`) or `api/client.ts`.
- Coverage thresholds.
- Moving more logic out of screens just to test it; only what's already pure.

## Notes

- Install with the mobile workspace's dev dependencies at the same Vitest major as the API (4.x). Vitest isn't an Expo
  native module, so plain `yarn workspace @kopiyka/mobile add -D` is fine (no `expo install`).
- `format.ts` must stay free of React Native imports for this to work; check before writing tests.
- Can run before or after 009. If before, 009 adds tests for its parsers; if after, this brief covers them.

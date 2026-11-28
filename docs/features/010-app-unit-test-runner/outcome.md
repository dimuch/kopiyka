# Outcome: App unit test runner

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#20](https://github.com/dimuch/kopiyka/pull/20) App unit test runner — before versioning

## Decided

- Vitest 4, the API's range, in `@kopiyka/mobile`, with a three-line `vitest.config.mts` that resolves `@/` through
  Vite 8's `tsconfigPaths`. The `.mts` name avoids a CommonJS warning on every run.
- Root `yarn test` runs every workspace's `test`, so CI picked up the app tests with no workflow edit.
- The app's lint script became `expo lint src test`, since `expo lint` skips `test/` by default.
- Table tests for `format.ts`, `monthSummary` and `quick`, with a fixed `Date` as the clock. The results don't depend
  on the machine's zone, so `TZ` isn't pinned. Built as planned.

## Left out

- Component or hook tests (jsdom, RNTL), coverage and a watch script.
- Fixing what the tests revealed; they pin today's behaviour.

## Follow-ups

- 009 must add tests for its link-param parsers — done in 009, #21
- `uah()` rounds negative halves toward zero — done in 011, #22
- `shortDate` shows "Sept" on newer ICU — done in 011, #22

Full plan: `git show c4d7a96c:docs/features/010-app-unit-test-runner/plan.md`

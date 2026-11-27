# Named comparators and one shared month schema in the API

Type: chore

## Why

Roadmap row R4 (`docs/features/refactor-roadmap-2026-11.md`). Two small things slow readers down in the API:

- Sorting uses nested ternaries: `compareCents` in `summary/routes.ts:56` and the date and key tie-breaks in
  `rankNames`' comparator (`expenses/nameSuggestions.ts:26-31`). A reader has to unpick `a < b ? -1 : a > b ? 1 : 0`
  each time.
- The same `z.object({ month: MonthString })` is declared three times: `MonthParams` in `income/routes.ts:21` and
  `balances/routes.ts:22`, and `Month` in `categories/routes.ts:53` (used for both a query and params there).

## What

- Replace the nested ternaries with named comparators, keeping `<`/`>` on the strings and bigints. Never switch to
  `localeCompare`, which orders strings differently.
- Export one `MonthParams` from `monthChecks.ts`, next to `MonthString`, and use it in the three route files.
- Separate commits for the comparators and for the shared schema.

## Acceptance criteria

- [ ] No nested ternary left in `summary/routes.ts` or `expenses/nameSuggestions.ts`
- [ ] Strings and bigints are still compared with `<` and `>` (no `localeCompare`)
- [ ] `monthChecks.ts` exports `MonthParams`; `income/routes.ts`, `balances/routes.ts` and `categories/routes.ts`
      declare no `z.object({ month: MonthString })` of their own
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified; API responses, error codes and SQL effects are the same
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed error codes or validation messages.
- Other schemas that merely look alike, and `apps/mcp`.

## Notes

Covered by: nameSuggestions.test, summary.int, income/balances/categories int tests. Base `origin/main` after R1
(#189) and R2 (#190): gates green, API 546 passed + 2 skipped (integration ran), MCP 327, app 510. R3 (brief 119, in
flight) takes 1.26.5, so this PR is 1.26.6 (re-bumped on rebase if needed).

# Move the connector's refusal tables out of tools.ts, and one month-income read

Type: chore

## Why

Roadmap row R5 (`docs/features/refactor-roadmap-2026-11.md`). `apps/mcp/src/mcp/tools.ts` is 553 lines. About 130 of
them (lines ~47–178), in front of `buildServer`, are the refusal and note tables the tools answer with, so a reader
has to scroll past every refusal text before reaching the first tool. The month-income read
(`scope.read<{ items: ApiIncomeItem[] }>(`/api/ledgers/${ledgerId}/months/${month}/income`)`) is also written out
three times: `month_summary`, `list_income` and `delete_income`.

## What

- Move the refusal and note tables unchanged to a new `apps/mcp/src/mcp/refusals.ts` and import them in `tools.ts`.
- Then, in its own commit, add `readIncome(scope, ledgerId, month)` in `tools.ts` and use it at the three reads.

## Acceptance criteria

- [ ] `apps/mcp/src/mcp/refusals.ts` holds the refusal and note tables, byte-identical text; `tools.ts` imports them
- [ ] `tools.ts` declares no refusal or note table before `buildServer`
- [ ] The month-income read is written once (`readIncome`) and used by `month_summary`, `list_income` and
      `delete_income`
- [ ] Move commit first, extract commit second
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified (an import path change for a moved symbol is allowed); tool
      answers, refusal texts and API calls are the same
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`; the MCP
      server's own `version` in `tools.ts` stays as it is

## Out of scope

- Bug fixes, new behaviour, changed refusal or note texts.
- `list_expenses`' inline mapping (JSON key order is what the model reads), per-route refusal mapping, other tools.

## Notes

Covered by: tools.test (47), mcp.test (18). Base `origin/main` after R3 (#191): gates green, API 548 passed + 2
skipped, MCP 327, app 510. R3 (#191) takes 1.26.5 and R4 (brief 120) 1.26.6, so this PR is 1.26.7 (re-bumped on rebase
if needed).

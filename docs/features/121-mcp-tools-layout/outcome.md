# Outcome: Move the connector's refusal tables out of tools.ts, and one month-income read

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#193](https://github.com/dimuch/kopiyka/pull/193) Move the connector's refusal tables out of tools.ts, and one month-income read — v1.26.7

## Decided

- Roadmap row R5, four commits in `apps/mcp`. A characterization test first pinned the API calls `month_summary` and
  `list_income` make, which no test asserted.
- A pure move took the refusal and note tables unchanged from `tools.ts` to a new `refusals.ts`; the only edits were
  `export` on the nine names `tools.ts` uses and an import.
- `readIncome(scope, ledgerId, month)` replaced the three copies of the month-income read, at the same spot, so every
  tool sends the same requests in the same order. It is a module-level helper, not a closure in `buildServer`, as the
  brief named it.
- New characterization cases were read as allowed under "existing tests pass unmodified".

## Left out

- Any refusal or note text change, merging the tables, or moving the DTO interfaces and `toolResult`.
- `list_expenses`' inline mapping, other tools, and a shared expenses or categories read (each is read only twice).

## Follow-ups

- `find-short-names.sh --diff` leaves out `apps/mcp/src` and `apps/mcp/test`, so connector briefs can't use it as a
  gate — in BACKLOG.md

Full plan: `git show 7d54a906:docs/features/121-mcp-tools-layout/plan.md`

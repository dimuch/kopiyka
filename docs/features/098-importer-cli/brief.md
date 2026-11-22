# Share the Notion importer scripts' command-line code

Type: chore (behaviour-preserving, runs through `/kopiyka-hos-refactoring`)

## Why

The three one-time Notion importers, `apps/api/scripts/import-{history,balances,income}.ts`, are about 130 lines
each, and roughly half of each file is the same command-line code copied by hand:

- the `parseArgs` options (`--save`, `--ledger`, `--snapshot`, `--apply`, and `--month` for balances and income)
  and the `ReturnType<typeof parseArgs<…>>` declaration;
- the save-or-import mode check and the `--ledger` id check, plus the `--month` check against `historyMonths()` in two of them;
- `--save`: read Notion, write the snapshot JSON with mode `0o600`, print what was saved, and exit;
- reading the snapshot file through its Zod schema, falling back to Notion, and the "Set NOTION_…, or pass
  --snapshot <file>." refusal;
- the `--month` filter, the "Dry run: nothing was written. Run again with --apply to write." line, and the
  `try / catch / finally db.end()` with "Nothing was written.".

`import-income.ts` says so itself: "a shared module is a refactoring follow-up" (brief 088). A fourth importer, or
a change to how snapshots are saved, would have to copy or edit all three. The scripts also have 17 lines with single-letter
callback names (`c`, `l`, `r`, `p`, `t`, `m`, `n`, `s`, `v`, `e`) across the five scripts.

## What

Nothing a person running the scripts can see changes: the same flags, usage text, stdout and stderr lines, exit
codes, snapshot file contents and mode, and database writes. Only the code moves:

- **One shared CLI module** next to the scripts (e.g. `scripts/importCli.ts`). It holds the flag parsing and
  validation (with `--month` optional per script), saving a snapshot, reading a snapshot or Notion, and running
  the dry run or `--apply` against the database with its "Nothing was written" handling. Each script passes in
  only what differs: its usage and Notion messages, its Notion reader and snapshot schema, its preview and import
  functions, and its `describe` lines.
- **Each importer** keeps only that: its options for the shared module, its `describe`, and its final summary line.
- **Descriptive names** replace the single-letter callback names in `apps/api/scripts/` (`find-short-names.sh
apps/api/scripts` comes back clean).

## Acceptance criteria

- [ ] `rg "parseArgs" apps/api/scripts/import-*.ts` finds nothing; the three importers use the shared module.
- [ ] `rg "0o600|Dry run: nothing was written|or pass --snapshot" apps/api/scripts` finds each string only in the
      shared module.
- [ ] Each `import-*.ts` file is under 80 lines.
- [ ] `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh apps/api/scripts` reports no hits.
- [ ] Behaviour unchanged: characterization tests run each importer as a process, before the move, and pin its
      exit code, stdout and stderr for a usage error, a bad `--month`, a missing Notion config, `--save` with a fake
      or missing Notion, a dry run from a snapshot file and `--apply` from a snapshot file (against the test MySQL).
      Those tests and every existing test pass unmodified after the move.

## Out of scope

- Bug fixes, new flags, changed messages or exit codes. Anything odd found while pinning behaviour is listed as a
  follow-up, not fixed.
- The `src/notion/*Import.ts` modules and their SQL (brief B on the roadmap), and `create-user.ts` and
  `migrate.ts` apart from the name fixes.
- Merging `notion-start.ts` into the shared module: it has different flags and no snapshot.
- The API routes, the app, and the MCP connector.

## Notes

- Version: `patch` (conventions §8b).
- No test runs the scripts today, so the characterization slice comes first. The scripts call `process.exit`
  at the top level, so the tests have to run them as child processes (`tsx`) with a test env, not import them.
- `import-history` has no `--month`, and its `--apply` error says which months were written before it stopped.
  The shared runner has to let it keep that line.
- PR C of the refactor roadmap from the 2026-11-21 scan. The order is: A API month guards (PR 138), C importer
  scripts, G small cleanups, B Notion/route shared SQL, then D, E and F in the app.

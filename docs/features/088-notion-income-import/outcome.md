# Outcome: Import January–October income from Notion

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#128](https://github.com/dimuch/kopiyka/pull/128) Import January–October income from Notion — v1.10.0

## Decided

- `yarn api import-income` copied the balances importer's design: `--save`, a dry run, `--apply` and `--month`.
- One-time and insert only (Gate A): a month that already has any of the ledger's items is skipped whole and named;
  nothing is updated or deleted. One PR instead of two.
- Each Notion row became one item owned by the ledger's owner, with its Name as the title and its Amount in EUR.
- In the build, `planImport` also ran the stored-items read, and the CLI repeated about 50 lines of
  `import-balances` rather than ~15. `main` took 1.9.0 meanwhile, so this shipped as 1.10.0.

## Left out

- Notion's `Source`, `Type`, `Note` and `Netto calculator` columns, and any "who earned it".
- A migration, API route, app or demo change, and a month-ended check (the month lock guards people, not imports).

## Follow-ups

- A refactor brief to share the three importers' CLI code — done in 098, #140.
- Run the import in production after the deploy — done (laptop and production, 2026-11-21).
- Brief 089 (period statistics) reading January–October income — done in 089, #130 and #131.

Full plan: `git show 5df77d36:docs/features/088-notion-income-import/plan.md`

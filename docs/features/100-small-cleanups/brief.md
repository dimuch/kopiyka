# Small cleanups: Notion client helpers, the /mcp URL, unused exports and Notion names

Type: chore (behaviour-preserving, runs through `/kopiyka-hos-refactoring`)

## Why

A few small repeats and loose ends are left over from the earlier refactor scan (2026-11-21) and PR A:

- **Notion client** (`apps/api/src/notion/client.ts`):
  - A title property's text is read with `title.map((t) => t.plain_text).join('')` in 3 places.
  - Pages in Notion's trash are skipped by hand-written `results … as Array<{ id; in_trash? }>` and `!r.in_trash`
    code in 4 places: `queryAll`, the groceries `find`, and twice in `monthRows`.
- **The connector's resource URL**: `${config.publicUrl}/mcp` is built in 3 files (`mcp/routes.ts`,
  `oauth/token.ts`, `oauth/authorize.ts`). The three must stay equal, or tokens stop matching their resource.
- **Exports nothing imports**: 9 constants and functions are exported but used only inside their own file:
  `DATE_RE`, `SESSION_COOKIE`, `STEP_SECONDS`, `ISSUER`, `MAX_FAILURES`, `WINDOW_MS`, `MAX_FALLBACK_DAYS`,
  `takePendingUndo` and the demo's `SAMPLE_RATE`. Each looks like part of its module's interface, but isn't.
- **Single-letter names in `apps/api/src/notion/`**: 59 lines, among them the three PR A left as follow-ups
  (`balancesImport.ts` `r`, `totals.ts` `r`, `historyImport.ts` `e`).

## What

Nothing a client, a test or the database can see changes. Only the code moves:

- **Notion client**: one helper for a title's plain text, and one for a query answer's pages that aren't in trash.
  Every place above uses them.
- **Resource URL**: built in one place in `apps/mcp/src`, and the three files use it.
- **Exports**: the 9 lose `export`, and keep their names and values.
- **Names**: descriptive names replace the single-letter ones in `apps/api/src/notion/`.

## Acceptance criteria

- [ ] `rg "plain_text\)\.join" apps/api/src/notion/client.ts` finds only the title helper, and
      `rg "in_trash\)" apps/api/src/notion/client.ts` finds only the live-pages helper.
- [ ] ``rg '\}/mcp`' apps/mcp/src`` finds one match: the resource URL, built once (3 today).
- [ ] None of the 9 symbols is exported, and each is still used in its own file.
- [ ] `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh apps/api/src/notion` reports no hits.
- [ ] Behaviour unchanged: existing tests pass unmodified; API, connector and app responses, error codes and
      SQL effects are the same; integration tests ran against MySQL.

## Out of scope

- Bug fixes, new behaviour, changed messages or error codes.
- The connector's `list_expenses` reusing `expenseFields`. It puts `categoryName` between `categoryId` and the
  amounts, and tool results go out as `JSON.stringify` text, so reusing it would reorder the JSON a client sees.
- Exported types that nothing else imports, such as the route DTOs and Notion row types. They name what an exported
  function takes or returns, so they stay exported.
- Single-letter names outside `apps/api/src/notion/` (about 29 more lines in the API). Those can be their own
  rename slice later.
- The shared SQL between the routes and the Notion import (brief B), and the app hooks and UI (D, E, F).

## Notes

- Version: `patch` (conventions §8b), 1.15.4 → 1.15.5. PR 141 bumps to 1.16.0; if it merges first, this one rebases
  and bumps to 1.16.1.
- Coverage:
  - Notion client: `test/notionClient.test.ts`, plus the Notion `.int` suites.
  - Resource URL: `apps/mcp/test` (oauth and mcp tests).
  - Unused exports: typecheck. Removing `export` from a used-only-locally symbol can't change behaviour, but a stale
    import would fail to compile.
  - Names: the Notion unit and integration tests.
- PR G of the refactor roadmap, after A (PR 138) and C (PR 140). Next: B, then D, E and F.

# Plan: Remove the Notion sync and import code

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR A `chore/remove-notion` (this worktree); PR B `chore/remove-notion-api`
Base: PR A on origin/main (129fb8f, v1.23.1); PR B on origin/main after PR A is merged **and deployed**

## Approach

The brief's premise doesn't hold, so this is two PRs, with the app first (decided by the user, Open question 1). Here is what a
shipped build does today when `GET /api/ledgers/:id/notion/status` answers the API's generic 404:

- `app.ts:88`: the generic 404 is `{ error: 'not_found' }`.
- `api/client.ts:94-96`: the client throws `ApiError(404, 'not_found')`.
- `useNotionSync.ts:11-12`: `notConfigured` matches only `status === 404 && code === 'notion_not_configured'`.
- `useNotionSync.ts:39`: any other error goes to `setFailed`, so the state becomes `failed`.
- `(tabs)/index.tsx:76-77`: Home shows `<LoadError message="Couldn’t check Notion sync." onRetry=… />`.

So the panel only stays hidden because production answers `404 notion_not_configured` (`notion/routes.ts:23-27`,
with `config.notion` null). After the routes are gone, a lagging tab sees a red alert with Retry, and Retry fails
again.

PR A takes the panel out of the app. The API stays as it is, so nothing visible changes anywhere. Once PR A is live
and open tabs have reloaded, no real client calls the routes. Then PR B deletes `apps/api/src/notion/`, the four
scripts, the `NOTION_*` settings, the tests and the docs. Data, migrations and the four `notion_*` tables stay.

Alternative considered: one PR, in the brief's order (API, then app, then docs). It's smaller in process, but every
web tab still running ≤ 1.23.1 shows the error above until it reloads. Under §8b that's `major` ("API route … a
shipped app build uses removed"). The user chose two PRs instead (Open question 1).

The code goes in one API slice, not two. `history.ts` imports `notionNames` from `totals.ts`, `totals.ts` imports
`yearBounds` from `groceries.ts`, and `config.ts` imports the `NotionApiConfig` type from `client.ts`. Taking out the
importers before the sync (or the other way round) would leave live-but-dead Notion code for a commit. The slice is
large in deleted files and small in hand edits (about 150 lines).

## Contracts

- DB: none. No migration. `notion_grocery_rows`, `notion_syncs`, `notion_total_adds` and `notion_counted_expenses`
  stay, unused, so a rollback to ≤ 1.23.x still runs.
- API (PR B):
  - `GET /api/ledgers/:id/notion/status` and `POST /api/ledgers/:id/notion/sync` are removed. They answer
    `404 { error: 'not_found' }` from the global not-found handler (`app.ts:88`), before any guard, so a signed-in
    member gets the same reply as anyone.
  - `AppDeps` loses `notionGroceries` and `notionExpenses`.
  - `Config` loses `notion` and `notionApi`, and the `NotionScope` type goes.
  - The `Env` schema loses the nine `NOTION_*` keys and the `UUID` regex. `z.object` strips unknown keys (checked
    with the repo's Zod: `{A:'y', NOTION_TOKEN:…}` parses to `{A:'y'}`), so an old `.env` loads, and a half pair that
    used to throw is now ignored too.
- Scripts (PR B): `yarn api notion-start`, `import-history`, `import-income` and `import-balances` are removed, with
  `scripts/importCli.ts`. Only the three importers use `importCli.ts`.
- App (PR A):
  - `api/types.ts` loses `NotionStatus`, `GroceryFailure`, `TotalsFailure` and `NotionSyncResult`.
  - Home no longer calls `/notion/status`.
  - `format.ts` loses `kyivDayTime`, which only `notionSync.ts` used.
  - The demo is unchanged. It never held these modules: they're in `BANNED_IN_DEMO`.
- Reuses: Home calls `useUndoOffer(reload)`, as the demo's Home already does (`src/demo-app/(tabs)/index.tsx:22`).
  The new `month_balances` write in the actual End test copies `storeBalance` in `test/balances.int.test.ts:32`. It
  stays local: two callers, not three.
- New dependencies: none.

## Version

Bump: patch, twice. PR A: 1.23.1 → 1.23.2. PR B: 1.23.2 → 1.23.3, or main's number + 1 if main moved (§8b step 4).
Why:

- PR A: production loses code but shows the same thing. The panel is hidden in production and on the laptop (no
  `NOTION_LEDGER_ID`), so it's patch ("behaviour-preserving refactor").
- PR B: the routes go once no real client calls them, since PR A's build doesn't. The scripts are admin tools, not a
  §8b contract (app builds, connector, accounts and data, rollback). Rollback is kept because no schema changes.
  That's patch too.

Minor doesn't apply to either PR: §8b's minor row is "a new capability", and nothing is added. The user chose these
two patch PRs over one `major` PR (Open question 1).

## Slices

### PR A: the app (branch `chore/remove-notion`)

- [x] 0a. Bump version to 1.23.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.2
- [x] 1. Remove the Sync to Notion panel from Home
  - Files:
    - delete `apps/mobile/src/components/NotionSyncPanel.tsx`, `src/data/useNotionSync.ts`,
      `src/data/notionSync.ts` and `test/notionSync.test.ts`
    - `src/app/(tabs)/index.tsx`, `src/api/types.ts`, `src/format.ts`, `test/format.test.ts`,
      `scripts/buildCheck.mts`, `test/buildCheck.test.ts`, `test/demoExpenses.test.ts`
  - Change:
    - Home: drop the `NotionSyncPanel`, `useNotionSync` and `LoadError` imports, `const notion`, and the panel and
      error JSX with its comment. The restore callback becomes `useUndoOffer(reload)`, so the Notion-only
      `notion.reload()` goes.
    - Types: drop the four Notion DTOs.
    - `format.ts`: drop `kyivDayTime` and its four formatters (`kyivDayNumber`, `kyivMonthShort`, `kyivHour`,
      `kyivMinute`). Nothing else uses them.
    - `format.test.ts`: drop the `kyivDayTime` case. The `shortMonthLabel` case stays, under
      `describe('format: month labels')`.
    - `buildCheck.mts`: drop the three Notion paths from `BANNED_IN_DEMO` and the `/notion/i` text ban (fix the
      comment above `BANNED_TEXT`). `buildCheck.test.ts`: drop the matching three paths and the two "notion, in any
      case" rows. The "bans only paths that exist" test fails if the paths stay, so this has to be one commit.
    - `demoExpenses.test.ts`: the unknown-route example becomes `/api/ledgers/1/nope`.
  - Size: about 470 lines in deleted files (419 of them whole files), about 35 hand edits.
  - Tests:
    - `yarn mobile test`: format, buildCheck and demoExpenses pass; `notionSync.test.ts` is gone.
  - Verify:
    - Web at 390×844, light and dark: Home before and after, with 104's layout snapshot script (104 plan, "Snapshot
      script") with keys `snap:before:109:home:<scheme>` and `snap:after:109:home:<scheme>`. Its `cmp` helper hard-codes
      the `104:` prefix, so change it to `109:` in the pasted snippet. They're identical. The network panel shows
      no `/notion/` request.
    - iPhone (Expo Go): Home looks the same, and delete then Undo on a category still refreshes the cards.
    - `yarn mobile export:web && yarn mobile check-builds` passes without `--accept`.
    - `rg -il notion apps/mobile/dist apps/mobile/dist-demo -g '*.js'` finds nothing (bundles only: the source maps' `sourcesContent` still holds the kept history comments in `actual-end.tsx` and `categoryForm.ts`). Both folders are gitignored.

### PR B: the API, scripts and docs (branch `chore/remove-notion-api`, after PR A is live)

- [ ] 0b. Bump version to 1.23.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.23.3 (or main's number + 1)
- [ ] 2. Remove the Notion sync, importers and settings from the API
  - Files:
    - delete all of `apps/api/src/notion/` (10 files, 1,746 lines)
    - delete `scripts/notion-start.ts`, `import-history.ts`, `import-income.ts`, `import-balances.ts` and
      `importCli.ts` (405 lines)
    - delete `test/notion.int.test.ts`, the twelve `test/notion*.test.ts` and `notion*.int.test.ts`,
      `fakeNotion.ts`, `importScripts.test.ts`, `importScripts.int.test.ts`, `runScript.ts` and `offlineFetch.ts`
      (3,757 lines; only the deleted tests use the last four)
    - edit `src/app.ts`, `src/server.ts`, `src/config.ts`, `package.json`, `.env.example`, `test/helpers.ts`,
      `test/config.test.ts`, `test/actualEnd.int.test.ts` and `test/categories.int.test.ts`
  - Change:
    - `app.ts`: drop the two notion imports, the two `AppDeps` fields and `await notionRoutes(app, deps)`.
    - `server.ts`: drop `notionClient` and the two deps lines.
    - `config.ts`: as in Contracts.
    - `package.json`: drop the four script entries.
    - `.env.example`: drop the Notion block.
    - `helpers.ts`: drop `notion: null` and `notionApi: null` from `testConfig`, and the four `notion_*` names from
      `DATA_TABLES`. No test writes them any more, and `resetSchema` drops every table.
    - `config.test.ts`: drop the four Notion cases (sync scope, API settings pairs, Opening/Actual Closing (085), Income (088);
      `config.test.ts:18, 29, 67, 85`). Add "ignores settings it no longer reads (an old `.env`'s
      removed keys, brief 109)": `loadConfig({ ...base, OLD_PAIR_A: '1', OLD_TOKEN: 'x' })` `toEqual(loadConfig(base))`.
      The key names are generic: see Open question 2.
    - `actualEnd.int.test.ts`: drop the `importBalances` import and the `october` object. Add a local
      `storeOctober(closing = '-35.00')`:
      `INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, '2026-10-01', ?, ?) ON DUPLICATE KEY UPDATE opening_eur = ?, closing_eur = ?`
      with params `[owner.ledgerId, '0.00', closing, '0.00', closing]`: each value bound twice, in the style of
      `balances/routes.ts:121` (`ON DUPLICATE KEY UPDATE closing_eur = ?`), not the deprecated `VALUES()`.
      Call it in `beforeEach`. Rename the brief 102 case "keeps an actual End when October's stored balances are
      written again" and call `storeOctober('-40.00')` there, so the rewrite really changes `month_balances`. Its
      expectation is unchanged, which proves the rewrite leaves `month_actual_ends` alone
      (`{ openingEur: '0.00', closingEur: '50.00', actual: true }`).
    - `categories.int.test.ts`:
      - drop the `notion/groceries` and `notion/totals` imports
      - drop `describe('Notion after a removal')` (lines 763-805)
      - drop the "Notion matches on tech_name" rename check (lines 913-917)
      - rename "lists the 15 seeded categories in Notion order" to "… in their default order"
  - Size: about 5,900 lines in deleted files, about 220 deleted and 25 added by hand.
  - Tests:
    - `yarn test` with `DATABASE_URL_TEST` exported (worktree memo).
    - `actualEnd.int.test.ts`: all cases, including the renamed one.
    - `config.test.ts`: the new case.
    - `balances.int.test.ts`, unchanged: "starts the month after an imported one at its End" and "keeps an imported
      month as stored".
    - `errors.test.ts`, unchanged: "answers an unknown route with not_found".
  - Verify:
    - `yarn api dev` with the laptop's `.env`, which still holds `NOTION_TOKEN` and the data source ids, starts, and
      `/api/health` answers `{ ok: true }`.
    - Signed in as claude-qa (cookie from the web app):
      `curl -s -o - -w ' %{http_code}' -b <cookie> http://127.0.0.1:3000/api/ledgers/<id>/notion/status` gives
      `{"error":"not_found"} 404`, and the same with `-X POST …/notion/sync`.
    - `yarn api notion-start` (and each importer) answers Yarn's "Couldn't find a script named …".
    - Budget tab, ledger 1, October 2026: the Start → End line matches a screenshot taken on main, and November's
      Start equals October's End.
- [ ] 3. Remove the Notion setup and import steps from the READMEs
  - Files: `README.md`, `deploy/README.md`
  - Change:
    - `README.md`: remove "### Notion sync" (lines 31-98).
    - `deploy/README.md`:
      - remove the "No NOTION_\*" comment in the `api.env` block (lines 113-114)
      - in "Starting from the laptop's ledger", say once that January–October 2026 was imported from Notion (briefs
        049, 085, 088) and the import code was removed in brief 109; drop steps 3-4, renumber, and drop the
        "Notion changed" and "The laptop imports" paragraphs
      - remove "Importing each month's balances from Notion" and "Importing January–October income from Notion"
        (lines 284-399)
  - Size: about 250 deleted, 10 added.
  - Verify: `rg -n -i notion README.md deploy/README.md` finds only the one history sentence. `yarn format:check`
    passes.
- [ ] 4. Stop pointing the skills at Notion code and update the backlog
  - Files: in both `.claude/skills/` and `.github/skills/` (`docs/copilot.md`: change both copies):
    `kopiyka-conventions/SKILL.md`, `kopiyka-refactoring/SKILL.md`, `kopiyka-hos-refactoring/SKILL.md`,
    `kopiyka-store-audit/scripts/store-audit.mjs`, `kopiyka-store-audit/references/{apple,google}.md`. Also
    `docs/features/BACKLOG.md`.
  - Change:
    - Conventions §1: drop "imports (`notion/historyImport.ts`)". §8b's "no … Notion ids" rule for release notes
      stays: old history still holds them.
    - Refactoring:
      - drop "Notion calls" from the side-effects list
      - "sync loops in `notion/`" → "loops in route handlers"
      - the `a` for `notion_total_adds` example → a table that exists
      - the `apps/api/src/notion` target → `apps/api/src/categories`
      - the `notion/totals.ts` example → `categories/monthLists.ts`
    - hos-refactoring: the domain example `notion` → `income`, and the example subject → a non-Notion one.
    - store-audit:
      - drop the `grep(apiFiles, /notion/i)` A6/G9 check. It would still fire on the history comments in
        `balances/carry.ts` and `defaultCategories.ts`.
      - drop the Notion clauses in A6, G9 and the App Privacy and review-notes bullets.
    - BACKLOG:
      - move 109 from "Next" to "Recently finished" and fix its version sentence
      - drop "NotionSync's 13pt button text" (104 list) and the "Importer CLI oddities" follow-up
      - line 97 ("single-letter names … outside `apps/api/src/notion/`"): drop the path, which no longer exists
      - line 111 ("check it in Notion (090)"): say the July/August data came from brief 085's import and is checked
        by hand on the Budget tab now
      - keep "Drop the four `notion_*` tables"
  - Size: about 25 changed per copy, plus about 15 in the backlog.
  - Verify:
    - `rg -n -i notion .claude/skills .github/skills` finds only §8b's release-notes rule.
    - `node .claude/skills/kopiyka-store-audit/scripts/store-audit.mjs` runs, with no A6/G9 line.

## AC → evidence

| AC                                                                                                                      | Evidence                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `notion/` module, `NOTION_*` setting or Notion route mentioned under `apps/`, apart from deliberate history comments | After slice 2, `rg -n -i notion apps -g '!node_modules'` finds only the kept hits listed under Risks. They're quoted in the PR B test plan.                                                                                                                                                                                     |
| Both routes answer 404 with the normal not-found reply for a signed-in member                                           | Slice 2: the curl check gives `{"error":"not_found"} 404` for GET status and POST sync. `errors.test.ts` "answers an unknown route with not_found" pins the reply shape.                                                                                                                                                        |
| The API starts with an old `.env` (every `NOTION_*` key) and with none                                                  | `config.test.ts`: the new "ignores settings it no longer reads" case, and the existing base case (none). Slice 2: `yarn api dev` with the laptop's real `.env`.                                                                                                                                                                 |
| The four scripts no longer exist                                                                                        | Slice 2: `package.json` diff, and `yarn api notion-start` / `import-history` / `import-income` / `import-balances` each answer "Couldn't find a script named".                                                                                                                                                                  |
| Home shows no Sync panel; the rest is unchanged on web 390×844 (light and dark) and iPhone                              | Slice 1: layout snapshots before and after are identical, the network panel shows no `/notion/`, and the iPhone (Expo Go) looks the same.                                                                                                                                                                                       |
| The Budget line for an imported month (October 2026, ledger 1) is unchanged; November starts from October's End         | Slice 2: before and after screenshots of the Budget tab. `balances.int.test.ts` "starts the month after an imported one at its End" and "keeps an imported month as stored".                                                                                                                                                    |
| No migration drops a table; `month_balances`, `expenses` and `income_items` rows untouched                              | `git diff --stat origin/main -- apps/api/migrations` is empty in both PRs. The laptop's `SELECT COUNT(*)` of the three tables is the same before and after slice 2.                                                                                                                                                             |
| The demo holds the right modules, with no Notion module in either build                                                 | Slice 1: `yarn mobile export:web && yarn mobile check-builds` (no `--accept`), and `rg -il notion apps/mobile/dist apps/mobile/dist-demo -g '*.js'` finds nothing (bundles only: the source maps' `sourcesContent` still holds the kept history comments in `actual-end.tsx` and `categoryForm.ts`). CI repeats `check-builds`. |
| `README.md` and `deploy/README.md` no longer describe Notion setup, sync or imports                                     | Slice 3: the `rg` check.                                                                                                                                                                                                                                                                                                        |
| `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests run                            | Every slice, with `DATABASE_URL_TEST` exported from the main checkout's `.env`. The PR test plan records "integration tests ran (not skipped)".                                                                                                                                                                                 |

## Not doing (YAGNI)

- A stub route that keeps answering `notion_not_configured`. It breaks AC1 and AC2, and the two-PR order makes it
  unnecessary.
- Dropping or emptying the `notion_*` tables, or touching migrations 004-006. That's a follow-up brief.
- Rewording history comments that still explain something true: `defaultCategories.ts:1`, `balances/carry.ts:4`,
  `balanceCarry.test.ts:22`, `actual-end.tsx:22`, `categoryForm.ts:16`, `categoryForm.test.ts:7`.
- `deploy/export-ledger.sh:12`'s "Notion records". The tables still exist.
- Moving `storeBalance` into `helpers.ts`.
- Editing older briefs, plans, audits, or 104's plan.

## Risks

- **AC1 can't be met literally.** These hits stay after slice 2 and aren't comments:
  - migrations `004_notion_grocery_rows.sql`, `005_notion_sync.sql`, `006_notion_totals.sql`, and the comments in
    `009`, `016` and `018`; migrations are immutable
  - the three file names in `test/migrations.int.test.ts`' `oldSchema` list, needed to replay the pre-007 schema
  - with them, the six history comments above

  Slice 2's `rg` output is checked against exactly this list (Open question 2).

- **Lagging tabs.** A tab still on ≤ 1.23.1 when PR B deploys shows "Couldn't check Notion sync." until it reloads.
  PR B is branched only after PR A has been deployed for at least a day (Open question 1), and the user reloads any
  open Kopiyka tab.
- **Stale docs between the PRs.** After PR A, `deploy/README.md:244-247` still says "Home → Sync to Notion", and
  `README.md`'s Notion section still describes the panel. Both are only for re-enabling a sync nobody runs, and PR B's
  slice 3 removes them. That's a known gap of about a day, not fixed in PR A.
- **The remote branch.** `origin/chore/remove-notion` already exists (9754988, the same brief commits under
  pre-rewrite SHAs). PR A's first push needs `git push --force-with-lease`, or the remote branch deleted first, with
  the user's OK at Gate B.
- **Hidden users of the deleted modules.** `rg` shows only `app.ts`, `server.ts`, `config.ts`, the scripts and the
  tests import `notion/`, and every shared primitive they used still has other callers: `techNameBase`,
  `SIGNED_AMOUNT_RE`, `e4ToString`, `convert`, `getEurUahRate`, `withTransaction`. Slice 2's typecheck and lint prove
  it.
- **A conflict with 104b–104f.** 104's plan lists `NotionSyncPanel` among the Button call sites. Whichever lands
  second rebases. If PR A lands first, 104b's brief skips the panel. `chore/filled-buttons` has no commits yet.

## Open questions

1. **Decided 2026-11-24 (user): two PRs, app first.**
   - PR A removes the Home panel: patch, 1.23.1 → 1.23.2.
   - PR B removes the API, scripts and docs: patch, → 1.23.3. It is branched from main only after PR A is merged and
     has been deployed for at least a day.

   The brief's claim ("minor version; installed builds get a plain 404 and already hide the panel on any error") was
   wrong. `useNotionSync` hides the panel only for `404 notion_not_configured`. The generic `404 not_found` that a
   removed route answers sets the state to `failed`, and Home then shows "Couldn't check Notion sync." with Retry,
   which fails again (evidence in Approach). Minor was wrong as a level too: nothing new is added.

   Options not taken:
   - one PR, which under §8b is `major`
   - a stub route answering `notion_not_configured`, which breaks AC1 and AC2

2. **Blocking: no.** AC1 vs immutable migrations, the migration test's file list, and AC2/AC3 evidence. Assumed
   meanwhile:
   - the hits listed under Risks are the deliberate ones
   - no committed test names a Notion route or a `NOTION_*` key; AC2 and AC3 are proved by the curl and dev-start
     checks plus a generic unknown-key config test

   If you'd rather have committed tests naming them, they become two more deliberate hits.

3. **Blocking: no.** The store-audit skill's Notion check and its reference rows aren't named in the brief.
   Assumed: they "point at Notion code", so slice 4 removes them.

## Follow-ups

- The PR B description says what to do by hand after it ships: revoke the Notion integration in Notion, and delete
  the `NOTION_*` lines from the laptop's `apps/api/.env`.
- Drop the four `notion_*` tables once PR B's release has run fine (brief 109, Out of scope; kept in BACKLOG).
- 104b–104f briefs: leave out `NotionSyncPanel` (104 plan, "Later parts").

## Deviations

## Consolidate

## Revision 1

- Open question 1 is decided (user, 2026-11-24): two PRs, app first, patch 1.23.2 then 1.23.3. PR B waits until PR A
  has been deployed for at least a day. The brief's "minor, plain 404" claim is recorded as wrong.
- Slice 2's `storeOctober()` binds each value twice (`ON DUPLICATE KEY UPDATE col = ?`, as in `balances/routes.ts`),
  not the deprecated `VALUES()`. The `VALUES()` risk is gone.

## Revision 2

Skeptic: APPROVE WITH EDITS.

- The web-export check greps `*.js` bundles only, because the source maps carry the kept history comments.
- `config.test.ts` drops four Notion cases, not three.
- Suggestions taken:
  - `storeOctober(closing)`, with the re-write test using `-40.00`
  - snapshot keys `109:home:<scheme>`
  - two BACKLOG lines added to slice 4
  - two Risks: the stale-docs window between the PRs, and the existing remote branch needing `--force-with-lease`

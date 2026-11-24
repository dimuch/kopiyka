# Remove the Notion sync and import code

Type: chore

## Why

Kopiyka started as a companion to a Notion budget, "Budget ’26". It synced each expense to Notion's Groceries and
Expenses tables, and it imported January–October 2026 (expenses, income, month balances) from Notion. Brief 102
finished the move away from Notion: each month's Start and End are now worked out in the app, and a month's real End
can be set by hand on the Budget tab. The history is imported on the laptop and in production. Production never
synced to Notion.

Nothing needs Notion any more. Its code (about 1,750 lines in `apps/api/src/notion/`, four scripts, fifteen test
files, a Home panel and nine `NOTION_*` settings) is now dead weight. It slows every change near expenses and
categories, and it keeps a third-party token in the laptop's config. The user decided on 2026-11-22 (brief 102, Out
of scope) to remove it once 102 shipped.

## What

Kopiyka stops talking to Notion entirely. Nothing it shows or stores changes for the user, apart from the Sync panel
going away.

- **API:** remove the sync routes (`GET …/notion/status`, `POST …/notion/sync`), the Notion client and every
  module under `apps/api/src/notion/`. Also remove the `notionGroceries`/`notionExpenses` app dependencies and their
  wiring in `server.ts`.
- **Scripts:** remove `notion-start`, `import-history`, `import-income` and `import-balances`, and their
  `package.json` entries. Shared CLI code (`importCli.ts`) goes too if nothing else uses it.
- **Config:** remove the `NOTION_*` settings and `notionApi` from `config.ts`. A `.env` that still has them must keep
  working, with the keys ignored.
- **App:** remove the Sync panel from Home (`NotionSyncPanel`, `useNotionSync`, `notionSync.ts`, the `NotionStatus`
  and `NotionSyncResult` types, and Home's reload on restore that only Notion needed).
- **Tests:** remove the Notion and importer tests and `fakeNotion.ts`. Tests elsewhere that use a Notion helper keep
  their meaning; for example, the brief 102 test "keeps an actual End when the balances are imported again" becomes
  a direct `month_balances` write.
- **Docs:** remove the Notion sections from `README.md` and `deploy/README.md` (import steps, `NOTION_*` env,
  snapshot files), and update the conventions or skills where they point at Notion code. Older briefs and plans stay
  as they are: they're history.

Data stays:

- `month_balances`, and every imported expense and income item, stay as they are. They are the ledger's real
  history, and the Budget line for January–October still reads `month_balances`.
- The four Notion bookkeeping tables (`notion_grocery_rows`, `notion_syncs`, `notion_total_adds`,
  `notion_counted_expenses`) stay in the database, unused, in this release. That keeps rollback to the previous
  release safe. A small follow-up brief drops them once this release has run fine.

Installed app builds still call `GET …/notion/status` on Home. Once the route is gone they get a 404, and they
already hide the panel on any error. So nothing visibly breaks, and this ships as a **minor** version. The planner
confirms that against `useNotionSync.ts` and Home before relying on it. If a shipped build would show an error
instead, stop and ask.

## Acceptance criteria

- [ ] No file under `apps/` imports from or mentions a `notion/` module, `NOTION_*` setting or Notion route. A
      repo-wide search for `notion` in `apps/` finds only comments that explain history, and each of those is
      deliberate.
- [ ] `GET /api/ledgers/:id/notion/status` and `POST /api/ledgers/:id/notion/sync` answer 404 for a signed-in member,
      with the API's normal not-found reply.
- [ ] The API starts with an old `.env` that still holds every `NOTION_*` key, and with one that holds none.
- [ ] `yarn api notion-start`, `import-history`, `import-income` and `import-balances` no longer exist.
- [ ] Home shows no Sync panel. Everything else on Home is unchanged on web at 390×844 (light and dark), and on the
      iPhone.
- [ ] The Budget line for an imported month (for example October 2026 on ledger 1) shows the same Start and End as
      before, and November still starts from October's End.
- [ ] No migration drops a table. Rows in `month_balances`, `expenses` and `income_items` are untouched.
- [ ] The demo build holds the right modules (`check-builds`), with no Notion module in either build.
- [ ] `README.md` and `deploy/README.md` no longer describe Notion setup, sync or imports.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, with the integration tests run.

## Out of scope

- Dropping the four `notion_*` tables (a follow-up brief, after this release has run).
- Changing or re-importing any imported data.
- The refactor roadmap's PR B (shared SQL between the Notion import and the API routes): it goes away with the
  import code.
- Rewording older briefs, plans or audits that mention Notion.

## Notes

- Brief 102's plan Follow-ups and `docs/features/BACKLOG.md` ("Named in earlier briefs and plans as its own brief")
  list this brief. Update the backlog when it ships.
- `category_months.display_name` (migration 009) came with the Notion work but is a real app feature (per-month
  category names). It stays.
- Comments that cite Notion only as the origin of a rule (for example `actual-end.tsx`: "like Notion's Actual
  Closing", `categoryForm.ts`: an imported name over 40 characters) can stay if they still explain something true.
- The laptop's `apps/api/.env` holds a Notion token. Once this ships, the user can revoke that integration in Notion
  and delete the keys. That's a manual step, so say it in the PR.
- Expect a large diff of deletions (well over 2,000 lines). The planner should split it where a split gives green,
  shippable steps (for example API and scripts, then app, then docs), not by line count alone.

## Open questions

- None. Decided 2026-11-24: remove all of it, including the importers; leave the tables and drop them in a later
  release; keep all imported data; let installed builds get a plain 404 (minor version).

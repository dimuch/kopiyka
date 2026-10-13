# Notion sync, part 5: "Sync to Notion" button on Home

Type: feature

Part 5 of 5 of "Sync expenses to Notion" (split on 2026-10-13). **Depends on 021-notion-groceries-sync**, which provides
the sync and status endpoints. The result text about categories and missing Netto pages needs 022 and 023. Building
this after all of them means building the UI once.

## Why

Parts 020–023 let the API send kopiyka's expenses to the Notion Budget ’26 tables, but only through an API call. The
user wants one button in the app that sends everything new and shows what happened.

## What

- **The button.** One **"Sync to Notion"** button on **Home** syncs everything at once.
- **Status line.** Next to the button, e.g. "5 new · last synced 10 Oct, 14:02", or "Up to date".
- **Result.** Pressing the button shows what happened, e.g. "Added 3 groceries, updated 1, removed 1 · added to 2
  categories". On errors it shows e.g. "2 couldn't sync · Retry", with the reasons, including missing Netto month pages
  ("No Netto page for Jan 2027").
- **A second press** while a sync runs is refused by the API, not doubled. The app shows that a sync is already
  running.
- **Hidden when unconfigured.** The button is hidden when the API answers that Notion isn't configured for this ledger
  (no config, or not the synced ledger).
- **The Notion token** lives only in the API's environment, never in the app.

## Acceptance criteria

The original 020 AC numbers are in brackets.

- [ ] **[6c] App.** Without Notion config (or for a ledger that isn't synced), the app hides the button.
- [ ] **[10] App** (web 390×844 and iPhone). The button and status show on Home; the result and error messages appear
      as above.
- [ ] **[11] Gates.** `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Automatic or scheduled sync: sync runs only on the button.
- Any API change beyond what 020–023 provide.

## Notes

- **Where the button goes.** Home is `apps/mobile/src/app/(tabs)/index.tsx` since #27 (brief 019): a header (title,
  month) and a 2×2 card grid (Budget, Expenses, Statistics, Settings). The button and status line fit as a full-width
  row under the grid.
- **API.** `GET /api/ledgers/:id/notion/status` returns `{ unsent, lastSyncedAt }`; `POST /api/ledgers/:id/notion/sync`
  returns the result. Unconfigured ledgers get 404 `notion_not_configured`. Check the exact shapes in the merged 021–023
  plans.

## Open questions

- None yet.

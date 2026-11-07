# A demo build that holds only what the demo uses

Type: feature. Needs brief 079 merged.

## Why

Kopiyka has no sign-up, so a visitor can't see what the app does. We want a demo anyone can try with no account and no
backend. A feature the demo doesn't offer must be absent from its files, not hidden: no Statistics or Settings code, no
sign-in, no API client, not even as dead code.

## What

A second web build of `apps/mobile`, chosen by `KOPIYKA_FLAVOUR=demo`. That variable is read only by the Node build
config, so the app's own code has no "is this the demo?" check anywhere.

Three things make the demo a different program:

- **Its own route tree**, `src/demo-app/`, set through Expo Router's `root` in a new `app.config.js`. Only routes in that
  folder exist. Shared screens are one-line re-exports. The root layout, tabs layout, Home and not-found page are the
  demo's own. Settings, Statistics, login, members and no-ledger have no route, so they're never bundled.
- **Module swaps** in a new `metro.config.js`, in the demo build only. A short table replaces `api/client`, the session
  module and the tab items module with versions in `src/demo/`.
- **An in-memory store** in `src/demo/`: the demo's `api()` answers the routes the demo uses from memory. Nothing is
  written to the browser, so a reload starts over.

**What the visitor gets**

- Home opens with no login, filled with made-up sample data for this month and last.
- Home, Income, Budget and Expenses work as in the real app: add, edit, delete, Undo, categories, planned amounts,
  income, copying a month, with the real rules (an ended month is read-only, planned can't go above income).
- Home has three cards: Income, Budget, Expenses. The tab bar has four tabs.
- A thin strip says it's a demo and that a reload clears changes, with a link to the real sign-in page.
- A reload clears everything the visitor did.
- Any other URL, such as `/settings`, lands on Home.

## Acceptance criteria

- [ ] Given the demo export, then its module list has no `app/(tabs)/settings`, `app/(tabs)/statistics`, `app/login`,
      `app/members`, `app/no-ledger`, `app/_layout`, `api/client`, `api/baseUrl`, `auth/`, `data/invites`, Notion, members
      or picker module.
- [ ] Given the demo bundle, then it has no `/api/auth/login`, no `Statistics` and no `notion` text.
- [ ] Given the production export, then its module list has nothing from `src/demo/` or `src/demo-app/`.
- [ ] Given the demo's module list, then it matches a list kept in the repo, so a new module reaching the demo fails CI
      until someone accepts it in a PR. CI builds both flavours and runs this check.
- [ ] Given `apps/mobile/src`, then no file outside `src/demo/` and `src/demo-app/` reads the flavour.
- [ ] Given a first visit, then Home opens with no login and sample data for this month and last.
- [ ] Given the demo, then only four tabs show, on tab pages and pushed pages, and Home has three cards.
- [ ] Given `/settings`, `/statistics` or `/members`, then the visitor lands on Home.
- [ ] Given an expense add, edit, delete or Undo, then totals update as in the real app, including the other currency,
      at a fixed sample EUR/UAH rate.
- [ ] Given changes to categories, planned amounts or income, or a copied month, then screens behave as in the real app.
- [ ] Given last month, then it's read-only with the real messages. Given a planned amount that takes the month above
      its income, then it's refused with the real message.
- [ ] Given changes and a reload, then they're gone and nothing is left in localStorage or any other browser storage.
- [ ] Given `connect-src 'none'`, then a full session works and shows no network call in the browser log.
- [ ] Given the store's rules, then unit tests cover each route and each refusal with a fixed clock.

## Out of scope

- Hosting, the deploy and the login link: brief 081.
- Any API, database or MCP change.
- A shared UI package or a separate repo.
- Copying demo data into a real account. A demo inside the mobile app. Analytics. A live exchange rate.

## Notes

- A spike on 2026-11-07 proved the build mechanism on Expo Router 57.0.26: 26 modules left out, including every one in
  the first criterion, and the page rendered with fonts under `connect-src 'none'`, with `fetch` blocked. Its data was
  stubbed, and it covered `expo export -p web` only, not `expo start` or typecheck. The plan must cover both, and add a
  launch config for the demo.
- `typecheck` doesn't see Metro's swaps, so each swapped module must be typed against the module it replaces.
- The store repeats API rules on the client, so an API rule change can leave it behind. Add this to the conventions.
- Sample data is invented and built from today's date on each load.

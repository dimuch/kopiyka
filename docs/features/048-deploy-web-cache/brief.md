# Deploy kit: fresh web app after a deploy, MySQL time zone check, import check

Type: chore

## Why

The deploy kit (brief 016, PR #25) is still current with main, but three things should be fixed before the first
production setup (runbook `deploy/README.md`, planned before 1 November 2026):

- **Stale web app.** `deploy/kopiyka.englishplus.com.ua.conf` sets no cache headers. A browser (or the iPhone home
  screen web app) may keep an old `index.html` after a deploy and keep running the old bundle until the cache expires.
- **MySQL clock.** The `created_at`/`updated_at` defaults use `CURRENT_TIMESTAMP`, the MySQL server's time zone, while
  the API reads every DATETIME as UTC (`apps/api/src/db.ts`, `timezone: 'Z'`). The droplet's MySQL time zone was never
  checked (the system clock is UTC; MySQL vars were unread on 2026-10-21).
- **Import check.** "Starting from the laptop's ledger" step 3 expects `15` categories after the import. The count is
  whatever October's live list holds on 1 November.

## What

- nginx answers `index.html` (including the single-page fallback for paths like `/budget?month=…`) with
  `Cache-Control: no-cache`, so every load revalidates it. The hashed build files Expo writes (under `/_expo/static/`)
  get a long `immutable` cache. Other static files (favicon, fonts, images) keep nginx's default behaviour unless
  the plan finds a reason to change it.
- Runbook step 1 adds a read-only MySQL check of `@@global.time_zone` and `@@system_time_zone`, says what is
  expected (UTC, or SYSTEM on a UTC system clock) and what to do if not.
- The import check says to expect October's category count from the laptop (with the query to get it), not 15.
- Anything else in `deploy/` that no longer matches main gets fixed only if found on the way, and listed.

## Acceptance criteria

- [ ] `nginx -t` accepts the vhost (checked locally in a container or with a local nginx, with stub cert paths).
- [ ] Against a local nginx serving a real `expo export -p web` output: `/` and an unknown path like `/budget` return
      `index.html` with `Cache-Control: no-cache`; a file under `/_expo/static/` returns a long `immutable` cache; `/api/`
      still proxies (a stub upstream is fine).
- [ ] Runbook step 1 has the MySQL time zone check with the expected result and the fix if it differs.
- [ ] The import check no longer hard-codes 15.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Doing the droplet setup or any SSH to the droplet.
- Changing the deploy flow, the build location, the service, or the GitHub workflow.
- Security headers (CSP, HSTS) and compression: possible later brief.

## Notes

- `app.json` has `web.output: "single"`, so the export is one `index.html` plus hashed bundles.
- The vhost is installed by hand (runbook step 8); a deploy never updates it, so this must merge before step 8.

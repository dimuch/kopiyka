# Outcome: Production deploy: subdomain, nginx, HTTPS, GitHub deploys

Brief: ./brief.md · Finished 2026-10-21

## PRs

- [#25](https://github.com/dimuch/kopiyka/pull/25) Production deploy: subdomain, nginx, HTTPS, GitHub deploys — before versioning

## Decided

- Repo files under `deploy/` and a manual `deploy.yml`: the CI gates run, then a key pinned to one forced command asks
  the droplet to deploy a commit on `main`. No app or API code changed.
- The droplet builds each release under memory caps, switches `current`, restarts the unit, and rolls back if
  `/api/health` fails.
- Migrations run in the unit's `ExecStartPre`, so the deploy user never reads the secrets. That turned the brief's
  "migrate, switch, restart" into "switch, restart".
- Review: production got its own MySQL user with rights on `kopiyka.*` only, and `deploy.sh` sets
  `YARN_ENABLE_SCRIPTS=false`. The `EXIT` trap removes a new release only when `current` doesn't point to it.

## Left out

- Building on the runner, Docker, staging, a zero-downtime switch, cache headers and HTTP/2.
- Backups, monitoring and native production builds (out of scope).

## Follow-ups

- `shellcheck deploy/*.sh` in CI — in BACKLOG.md
- Build on the GitHub runner, to spare the droplet or keep build-time dependency code off it — in BACKLOG.md
- Database backups and uptime monitoring — in BACKLOG.md
- A root-owned `AuthorizedKeysFile` for the deploy key — in BACKLOG.md
- Other droplet apps bind public ports — dropped: a note about other apps, outside this repo

Full plan: `git show 3c4d9474:docs/features/016-production-deploy/plan.md`

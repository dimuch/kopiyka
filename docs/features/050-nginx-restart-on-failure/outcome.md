# Outcome: Restart nginx after a crash

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#64](https://github.com/dimuch/kopiyka/pull/64) Restart nginx after a crash — before versioning

## Decided

- Docs only: the systemd drop-in was already installed on the server; its commands went into runbook step 8, next
  to the vhost, with a check in the after-deploy list.
- `printf` and `sudo tee` write the file, and `daemon-reload` makes systemd read it without restarting nginx.

## Left out

- A script in `deploy/` for it: three commands, run once per server.

## Follow-ups

None.

Full plan: `git show 39332f84:docs/features/050-nginx-restart-on-failure/plan.md`

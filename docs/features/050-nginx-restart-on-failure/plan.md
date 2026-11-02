# Plan: Restart nginx after a crash

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/nginx-restart-on-failure
Base: origin/main (36fafdb)

## Approach

Docs only: the drop-in is already on the droplet (installed 2026-11-02 by the user's sudo). Add its commands to
runbook step 8, next to the vhost (both are nginx setup done once by hand), and a check to the after-deploy list.
`printf` + `sudo tee` writes the file (a heredoc under `sudo` needs a shell); `daemon-reload` makes systemd read it
without restarting nginx.

## Contracts

- DB / API / App: none. Droplet: `/etc/systemd/system/nginx.service.d/restart.conf`
  (`[Service]`, `Restart=on-failure`, `RestartSec=5s`).

## Slices

- [ ] 1. Restart nginx after a crash, in the runbook (~20 lines)
  - Files: `deploy/README.md`, this plan.
  - Change: step 8 gets `sudo mkdir -p /etc/systemd/system/nginx.service.d`, the `printf … | sudo tee …/restart.conf`
    line and `sudo systemctl daemon-reload` (the `mkdir` makes it work on a fresh droplet), then one line on what it
    changes (only "start again after a crash"; stop, reload and restart as before; shared with the other sites) and
    the undo (`sudo rm /etc/systemd/system/nginx.service.d/restart.conf && sudo systemctl daemon-reload`). The
    after-deploy checklist gets `systemctl show nginx -p Restart` → `Restart=on-failure`, after the `301` line.
  - Verify: `yarn format:check`; the commands are the ones that ran on the droplet; read-only `ssh do` check of
    the file and `systemctl show nginx -p Restart`.

## AC → evidence

| AC              | Evidence                                                  |
| --------------- | --------------------------------------------------------- |
| Step 8 commands | slice 1 diff; same commands ran on the droplet 2026-11-02 |
| Checklist check | slice 1 diff                                              |
| Droplet matches | read-only `ssh do` output in the PR test plan             |
| Gates green     | slice 1                                                   |

## Not doing (YAGNI)

- No script in `deploy/` for it: three commands, run once per droplet.

## Risks

- None for the running droplet (nothing is installed by this PR).

## Open questions

## Follow-ups

## Deviations

## Consolidate

Skipped: docs only, no new function, route or query.

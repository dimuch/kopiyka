# Restart nginx after a crash

Type: chore

## Why

Ubuntu ships nginx with `Restart=no`: if it crashes it stays down, and every site on the droplet (kopiyka and the
neighbours) is offline until someone starts it by hand. The kopiyka API (`Restart=always`) and MySQL
(`Restart=on-failure`) already come back by themselves, and all three start at boot. On 2026-11-02 the user installed a
systemd drop-in on the droplet so nginx comes back too; the runbook doesn't say so, so a rebuilt droplet would miss it.

## What

`deploy/README.md`:

- Runbook step 8 (certificate and vhost) also installs the drop-in
  `/etc/systemd/system/nginx.service.d/restart.conf` (`Restart=on-failure`, `RestartSec=5s`) and reloads systemd,
  with a line on what it changes (only "start again after a crash"; stop, reload and restart as before; shared with the
  other sites) and how to undo it.
- The after-deploy checklist checks it: `systemctl show nginx -p Restart` → `Restart=on-failure`.

## Acceptance criteria

- [ ] Step 8 has the drop-in commands; running them on a fresh droplet gives `Restart=on-failure` for nginx.
- [ ] The after-deploy checklist has the check, with the expected output.
- [ ] The droplet already matches (checked read-only: the file's content and `systemctl show nginx -p Restart`).
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- An API health watchdog (the user declined; health is checked on demand).
- Changing the kopiyka or MySQL units, which already restart.
- Outside uptime monitoring.

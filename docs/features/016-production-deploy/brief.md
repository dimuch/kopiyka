# Production deploy: subdomain, nginx, HTTPS, GitHub deploys

Type: chore

## Why

Kopiyka only runs on a laptop. To use it day to day it needs a public HTTPS address on the existing
DigitalOcean droplet, and shipping a merged change should not mean SSH-ing in and building by hand.

The droplet is small and already busy. Measured 2026-10-08 (`ssh do`): 1 vCPU, 2 GB RAM + 2 GB swap,
~1.2 GB available, ~490 MB swap already in use. Ubuntu 26.04, Node 24.21, nginx 1.30, MySQL **8.4.11**,
certbot installed. It already runs choco-snake (:3000), gendash (Next.js, :3001), two pm2 apps
(englishplus.com.ua, uppr.com.ua) and more on :3900/:3950. DNS for `englishplus.com.ua` and `uppr.com.ua`
is DigitalOcean DNS; `~/subdomain-setup.sh` and `gendash.conf` show the house pattern (A record → nginx
vhost → certbot → systemd unit on its own loopback port).

Capacity check: **running** kopiyka fits easily (one Fastify process ~70–100 MB, the web app is static
files served by nginx, the database goes into the MySQL that already runs). **Building** on the droplet is
tight but feasible if the steps run one at a time with Metro limited to one worker. Peak RSS measured locally
(macOS, 2026-10-08):

| Step                                             | Peak RSS | Time (M-series) |
| ------------------------------------------------ | -------- | --------------- |
| `yarn install --immutable` (632 MB node_modules) | ~750 MB  | 15 s            |
| `yarn api build` (tsc)                           | ~350 MB  | 5 s             |
| `expo export -p web` default workers             | ~1.77 GB | 20 s            |
| `expo export -p web --max-workers 1`             | ~570 MB  | 32 s            |
| same + `NODE_OPTIONS=--max-old-space-size=700`   | ~445 MB  | 30 s            |

Each capped step fits in the ~1.2 GB available; expect several minutes on 1 vCPU and some CPU contention for
the neighbours during a deploy. Decision: try building on the droplet (user, 2026-10-08); if a real deploy
proves it too tight, moving the build to the GitHub runner is the fallback (follow-up, not this brief).

## What

- `https://kopiyka.englishplus.com.ua` serves the Expo web app (static export) and proxies `/api` to the kopiyka API on
  a free loopback port (not 3000/3001/3900/3950). Same origin, so the web session cookie works as today.
- HTTP redirects to HTTPS; Let's Encrypt certificate via certbot with auto-renewal (as for gendash).
- The API runs as a systemd service under its own unit, `NODE_ENV=production`, restarts on failure,
  secrets in a root-readable env file on the droplet only (never in the repo or in GitHub).
- A manually triggered GitHub Actions workflow ("Run workflow", `main` only) runs the CI gates on the
  runner, then SSHes to the droplet, which checks out that exact commit from the public repo into a new
  release directory, installs and builds there (memory-capped, one step at a time), runs pending DB
  migrations, switches the live release, restarts the service and checks a health URL. Merging does not
  deploy by itself.
- The repo holds the nginx vhost, the systemd unit, and a one-time bootstrap runbook/script (DNS record,
  database + user, env file, cert, deploy user + SSH key, sudo rule) for the user to run once by hand.

## Acceptance criteria

- [ ] Given DNS and the bootstrap are done, `https://kopiyka.englishplus.com.ua` loads the web app and a user can log in
      and add an expense.
- [ ] `http://` redirects to `https://`; the cert is valid and `certbot renew --dry-run` passes.
- [ ] A new A record `kopiyka` → 165.22.31.51 exists in the `englishplus.com.ua` zone (bootstrap step).
- [ ] The API listens on 127.0.0.1 only; it is not reachable from outside except through nginx `/api`.
- [ ] Running the Deploy workflow on `main` ships that commit: gates on GitHub, build on the droplet, migrate,
      restart, health check. A failed gate, install or build deploys nothing (live release untouched); a failed health check fails the
      workflow and rolls back to (or keeps) the previous release. Merging alone deploys nothing.
- [ ] Build steps on the droplet run sequentially with memory caps (Metro `--max-workers 1`, Node heap
      cap); a real deploy's peak memory and duration are recorded in the PR, and no other site on the
      droplet goes down during it. Old releases are pruned (keep a few).
- [ ] The GitHub deploy key can only deploy kopiyka (dedicated user or restricted key; sudo limited to
      restarting the kopiyka unit, if needed at all).
- [ ] Other sites on the droplet keep working; `nginx -t` passes before every reload.
- [ ] README's Deployment section describes the real setup (and the MySQL version matches production).

## Out of scope

- iPhone production build (EAS / TestFlight) and pointing the native app at the public API.
- Moving off the droplet, Docker, staging environment, zero-downtime/blue-green deploys.
- Database backups and monitoring/alerting (worth a follow-up brief).
- Changing the other apps on the droplet (e.g. their `*:3000`-style public binds) — note only.

## Notes

- The web client already assumes production is same-origin with `/api` proxied (`apps/mobile/src/api/client.ts`).
- `yarn api migrate` runs through `tsx` (a dev dependency); fine here because the droplet does a full install.
- Login throttle trusts `X-Forwarded-For` from loopback only; nginx must set it (README).
- CI pins MySQL 8.0 "same as production", but production is now 8.4.11.

## Decisions (2026-10-08)

- Domain: `kopiyka.englishplus.com.ua` (DigitalOcean DNS, same zone as gendash).
- Deploy trigger: manual only (`workflow_dispatch`).
- Process manager: systemd unit `kopiyka.service`, like gendash and snake.
- Build location: on the droplet (memory-capped), triggered from GitHub; repo is public, so no read key needed.

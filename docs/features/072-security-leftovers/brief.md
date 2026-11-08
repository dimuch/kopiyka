# Security leftovers

Type: chore

The security follow-ups left open by briefs 057, 063, 067, 068 and 069. Claude can now change and delete data (briefs 069 and
070), so a stolen connector token is worth more than when these were noted.

## Why

- **`/mcp` answers anyone.** `/oauth/token` and `/oauth/register` accept only Anthropic's outbound addresses, but `/mcp` itself
  doesn't. A sealed access token copied out of Claude could be used from any computer for up to an hour, and since 069 and 070
  it can change and delete a budget. The owner decided on 7 November that this limit goes in brief 072.
- **The login lock doesn't do what its comment says.** `apps/api/src/auth/throttle.ts` says "Failures older than 24 h no longer
  count", but `afterFailure` restarts the count only after 24 hours with no failure at all. Failures less than a day apart
  keep adding up, so 5 wrong codes spread over a week still lock the key.
- **`login_throttle` only grows.** Every login attempt keeps a row per username, IP and device, and nothing deletes them (a
  `TODO` in `throttle.ts`).
- **nginx limits count each IPv6 address on its own.** One client holds a whole /64, so it can get around every `limit_req` and
  `limit_conn` by changing addresses. The API's own login throttle already groups IPv6 by /64; nginx doesn't.
- **The two services have only a light sandbox.** `kopiyka.service` and `kopiyka-mcp.service` set `NoNewPrivileges`,
  `ProtectSystem=strict` and `PrivateTmp`, and nothing more: they can still reach system calls, kernel settings and networks
  they never use. A bug in either would reach more of the droplet than it needs.

## What

1. **`/mcp` from Anthropic only.** The vhost's `location = /mcp` gets the same `allow` lines as `/oauth/token`, then `deny all`.
   Anything else gets 403 and never reaches the connector. The `/.well-known/` and `/oauth/authorize` pages stay open, because a
   person's browser opens them.
2. **The login lock matches its words.** The comment changes to describe the stricter rule the code already has, with a
   test. See Decisions.
3. **Old `login_throttle` rows are deleted.** A row with no active lock and no failure in the last 24 hours is removed, so live
   counts and locks are never reset early. How and when it runs is the plan's choice (on login, or on a timer).
4. **nginx groups IPv6 by /64.** Every `limit_req_zone` and `limit_conn_zone` keyed by `$binary_remote_addr` uses the /64 for
   IPv6 and the full address for IPv4.
5. **The services are hardened.** Both unit files get systemd's sandboxing settings that the services work with (for example no
   new privileges, a read-only system, private `/tmp`, no access to home folders), checked with `systemd-analyze security`.

## Acceptance criteria

- [ ] A request to `/mcp` from outside Anthropic's ranges gets 403 from nginx and leaves no line in `journalctl -u kopiyka-mcp`.
      A real Claude connection still connects and answers a question.
- [ ] The login lock's comment and its behaviour agree, and a test pins the agreed rule with failures spread over more than
      24 hours.
- [ ] A test shows that pruning deletes only rows with no active lock and no failure in the last 24 hours, and leaves a locked
      row and a recent failure alone.
- [ ] Two IPv6 addresses in the same /64 share one nginx limit; two IPv4 addresses don't. Checked with `nginx -t` and a curl test
      from the droplet, or explained if a real IPv6 test can't be run.
- [ ] Both services start, pass their health checks and serve normally after the hardening, and `systemd-analyze security` gives
      each a better score than before. The scores before and after are written down.
- [ ] `deploy/README.md` says what changed on the droplet and how to undo each step.

## Out of scope

- The device id built with `Math.random()` in `apps/mobile/src/api/client.ts`: it touches the app and maybe a dependency, so
  it gets its own brief (plan 064).
- A failed `/api/ledgers` at launch signing the screen out (plan 067): an app behaviour, not a security fix.
- A `restore_expense` tool (plan 070), and `errForLog` keeping `cause` (plan 069).
- Changing the 1-hour token lifetime, adding refresh tokens, or CIMD.

## Notes

- Anthropic's outbound ranges are in the vhost's `/oauth/(token|register)` location, from
  `platform.claude.com/docs/en/api/ip-addresses`. If Anthropic changes them, `/mcp` stops too, until the vhost is updated.
  `deploy/README.md`'s "The address limit" section must say so.
- `limit_req` runs before `allow`/`deny`, so a flood from outside still gets 429 before 403.
- The vhost and unit files live in `deploy/`, but the droplet copies are installed by hand with sudo: the owner runs those
  steps, one at a time.
- No app change and no API contract change, so the version bump is likely `patch`; the plan decides.
- This is several small, independent changes. The plan may split it into more than one PR.

## Decisions (owner, 8 November 2026)

- **The login lock rule stays strict.** A key is locked after 5 failures with less than 24 hours between each, as today. The
  comment in `throttle.ts` changes to say so, and a test pins it. No behaviour change.

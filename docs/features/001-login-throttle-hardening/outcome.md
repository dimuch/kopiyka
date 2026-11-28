# Outcome: Login throttle hardening

Brief: ./brief.md · Finished 2026-10-07

## PRs

- [#10](https://github.com/dimuch/kopiyka/pull/10) Login throttle hardening — before versioning

## Decided

- The check and the count run in one transaction that locks the username, IP and device rows in a fixed order before
  the code is checked, so parallel attempts can't get past the count.
- A successful login doesn't count against the IP. Counting it first and refunding it would have locked a household
  out after 5 logins a day.
- `trustProxy: 'loopback'`, not a hop count: in Fastify 5 a number fails closed and every user would share one IP.
- `COOKIE_SECURE` became optional and defaults to true when `NODE_ENV=production`. Built as planned.

## Left out

- No change to the limits, keys or lockout policy, and no CAPTCHA, backoff, alerting or admin unlock (out of scope).
- No `TRUST_PROXY` env var (one deploy shape) and no deadlock-retry loop (the fixed lock order avoids deadlocks).

## Follow-ups

- The `INSERT IGNORE` then `FOR UPDATE` pattern that could deadlock — done in 001, #10
- Old `login_throttle` rows are never pruned — done in 072, #122
- The deploy needs its own port and an HTTPS-only vhost — done in 016-production-deploy, #25

Full plan: `git show e51c74bc:docs/features/001-login-throttle-hardening/plan.md`

# Login throttle hardening

Type: fix

## Why

The login throttle promises "5 wrong codes → 24 h block" per username, IP and device
(`apps/api/src/auth/throttle.ts:4-5`). Two gaps break that promise (audit
`docs/audits/2026-10-architecture.md`, A1–A3):

- **Concurrent requests get past the limit.** `anyLocked` is a plain read
  (`auth/routes.ts:46`), and the failure is only recorded after the TOTP check (`:70`). A burst
  of parallel wrong codes all pass the check before any failure is written.
- **The client picks the IP that gets throttled.** `trustProxy: true` (`app.ts:28`) makes
  `req.ip` the left-most `X-Forwarded-For` entry, which a client can forge. That lets it dodge the
  per-IP limit, or lock out someone else's IP.
- **The cookie can go out over plain HTTP.** `COOKIE_SECURE` defaults to `false`
  (`config.ts:12`), so a production deploy that forgets the variable sends the session cookie
  over HTTP.

## What

- An attempt counts against the username, IP and device before its code is checked. The
  check-and-count is atomic across concurrent requests. A successful login still clears the
  username and device counts, as today; the IP count still only decays.
- The API trusts `X-Forwarded-For` only from the loopback proxy (nginx on the same host), and
  takes the client IP from the entry nginx appended.
- In production the session cookie is `Secure` unless explicitly turned off.

## Acceptance criteria

- [ ] Given 10 wrong-code logins for the same username fired in parallel (`Promise.all` of
      `app.inject`), when they complete, then at most 5 answer `401 invalid_credentials` and the
      rest answer `429 blocked`; a following correct code answers `429`.
- [ ] Given 4 wrong codes and then a correct one, the login succeeds and the username's count is
      back to 0 (existing behaviour kept, covered by a test).
- [ ] Given a request from `127.0.0.1` with `X-Forwarded-For: 6.6.6.6, 203.0.113.9`, the
      throttled IP key is `203.0.113.9`, not `6.6.6.6` (integration test that locks the IP and checks
      which key is locked).
- [ ] Given `NODE_ENV=production` and no `COOKIE_SECURE`, the login cookie has the `Secure`
      attribute; `COOKIE_SECURE=false` still turns it off (unit test of `loadConfig` plus `.env.example`
      comment).
- [ ] Existing auth integration tests pass unchanged.

## Out of scope

- Changing the limits (5 attempts, 24 h), the keys, or the lockout policy.
- CAPTCHA, delays/backoff, alerting, or an admin unlock.
- nginx configuration (not in this repo); the README may note the expected `proxy_set_header`.
- Other auth refactors (e.g. moving `requireAuth` to `auth/guard.ts`, audit A10).

## Notes

- `recordFailure` already locks rows with `FOR UPDATE` in a fixed order. Reserving the attempt
  in the same transaction before `verifyTotp`, and keeping `resetAfterSuccess` for success, is
  probably the smallest change. The planner decides.
- Fastify `trustProxy` accepts an address list or a hop count. The API listens on `127.0.0.1`
  (`config.ts` `HOST` default).

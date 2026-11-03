# Wrong codes from strangers don't lock you out

Type: fix

From the OWASP review of 2026-11-02 (follow-up of brief 057).

## Why

Five wrong login codes for a username lock that username for 24 hours, whoever sent them
(`apps/api/src/auth/throttle.ts`: `MAX_FAILURES = 5`, `LOCK_MS` 24 h, counted per username, per IP and per device).
Anyone who knows a username can send five bad codes from anywhere and keep its owner out of the app for a day, and
again the next day. Usernames aren't secret: they show in invites and members lists, and the invite answer (201 for
an existing non-member, 409 otherwise) tells any logged-in user whether one exists.

The username count can't just be loosened: it's the only limit on an attacker who rotates IPs and device ids. A
6-digit code checked at ±1 step matches by chance with odds about 3 in 1,000,000 per guess. Today that's 5 guesses a
day, about 0.5 % a year. A 15-minute lock would allow ~480 a day, about 40 % a year.

## What

- A device that has logged in successfully as a user before (its device id) is a **known device** for that user. A
  locked username doesn't block a known device: its owner logs in as usual with a right code. The device's own count
  and the IP count still apply to it.
- Everyone else (unknown device, or no device id) is blocked by a locked username exactly as today, so a guesser's
  budget stays 5 per username per 24 h.
- A known device's wrong codes count against the username as today, so a stolen device id buys no extra guesses
  beyond the device's own limit.
- Logging out keeps the device known; nothing about it is shown in the app.

## Acceptance criteria

- [ ] After 5 wrong codes for `dimuch` from an unknown device, `dimuch` logs in with a right code from a device that
      logged in as `dimuch` before, and gets a session.
- [ ] In that state, a right code from an unknown device (or with no device id) still gets `429 blocked`.
- [ ] A device that logged in as `olena` is not a known device for `dimuch`.
- [ ] A known device's own lock (5 of its own wrong codes) and the IP lock still block it.
- [ ] Wrong codes from a known device still count against the username.
- [ ] Integration tests cover each case above; existing throttle and auth tests stay green.
- [ ] All gates pass: `yarn format:check && yarn lint && yarn typecheck && yarn test`.

## Out of scope

- Changing `MAX_FAILURES`, the 24 h window or lock, or the IP and device limits.
- The invite answer that reveals whether a username exists (see Open questions).
- nginx `limit_req`, pruning `login_throttle`, systemd hardening (other follow-ups of the same review).
- Any app UI. The app already sends a stable device id (`deviceId()` in `apps/mobile/src/api/client.ts`).

## Notes

- The device id is random per install (SecureStore on iOS, localStorage on web), not shown anywhere, and sent only to
  the login endpoint. It's a label, not a secret: guessing a user's 32-hex-character id isn't practical, and a known
  device is still held to its own 5-per-24 h limit.
- Clearing site data or reinstalling makes a new, unknown device; that person then waits out a lock like today.
- Storing which devices logged in as whom is a new table (user, device id, first and last success), so this needs a
  migration. Rows go when the user is deleted (cascade).

## Open questions

- Should a known device expire if unused (say 90 days), or stay known until the user is deleted? Planned default:
  never expires; the table is tiny.
- The invite 201/409 answer: leave it (users are only created by the admin script and know each other) or make
  unknown usernames indistinguishable too? Planned default: leave it, out of scope here.
- An admin unlock (a script that clears a username's lock) for someone locked out on a new device: add it here, or
  later if it's ever needed? Planned default: later.

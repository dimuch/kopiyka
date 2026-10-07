# Plan: Login throttle hardening

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/login-throttle-hardening
Base: origin/main (c60c564)

## Approach

Three independent fixes, one commit each.

1. **Atomic check-and-count.** One transaction in `auth/throttle.ts` locks the throttle rows for
   all keys, in the fixed username → ip → device order, before the code is checked. It answers
   `blocked` if any key is locked. Otherwise it runs the route's code check on the same
   connection, then writes the failure (`afterFailure`) or clears the username/device counts, and
   commits. A concurrent attempt on any shared key waits on the row lock, so it can't be checked
   until the earlier attempt's count is written. That is how this plan reads "counts before its
   code is checked" (see Open questions).
2. **Trusted proxy.** `trustProxy: 'loopback'` in `app.ts`.
3. **Secure cookie in production.** `COOKIE_SECURE` becomes optional in `config.ts`. When it is
   unset, it defaults to `NODE_ENV === 'production'`.

Alternative considered for 1: reserve first, i.e. a short transaction that runs `afterFailure` for
every key before the check, then a refund on success. Rejected for three reasons. A success would
need an IP refund (and an unlock on the 5th attempt), or every successful login would count
against the IP. With 30-minute sessions, a household on one IPv4 would be locked out after 5
logins a day. It also needs two transactions instead of one.

Alternative considered for 2: a hop count (`trustProxy: 1`). Rejected because in the installed
Fastify 5.12.5 a number fails closed (`lib/request.js` `getTrustProxyFn` returns `() => false`).
`req.ip` would then always be `127.0.0.1`, and every user would share one IP key.

## Contracts

- DB: none (the `login_throttle` schema is unchanged).
- API: `POST /api/auth/login` keeps the same body, the same responses and the same errors
  (`400 invalid_request`, `401 invalid_credentials`, `429 blocked`). Two behaviour changes:
  concurrent attempts are serialised per key, and `req.ip` comes from `X-Forwarded-For` only when
  the TCP peer is loopback.
- `auth/throttle.ts` replaces `anyLocked`, `recordFailure` and `resetAfterSuccess`. Their only
  caller is `auth/routes.ts`. The replacement:
  ```ts
  export type Attempt<T> = { outcome: 'blocked' } | { outcome: 'rejected' } | { outcome: 'accepted'; value: T };
  /** Locks the throttle rows for `keys`; if none is locked, runs `check` on that connection and counts
   *  a failure (null) or clears the username/device counts (non-null). `check` must use only `conn`:
   *  a second pool connection while holding the rows can starve the pool (limit 10). Throttle rows
   *  are always locked before the users row, which `check` updates. */
  export async function throttledAttempt<T>(
    db: Db,
    keys: ThrottleKey[],
    now: Date,
    check: (conn: PoolConnection) => Promise<T | null>,
  ): Promise<Attempt<T>>;
  ```
  `PoolConnection` is exported by `mysql2/promise` 3.24.5. The function creates rows with
  `INSERT … ON DUPLICATE KEY UPDATE key_value = key_value` instead of `INSERT IGNORE`. MySQL docs
  (innodb-locks-set): a duplicate on a plain INSERT takes a **shared** lock, "which can result in
  deadlock" with several sessions. ODKU takes an exclusive index-record lock on a duplicate primary
  key. The `SELECT … FOR UPDATE` that reads the row stays. If the attempt is blocked or throws,
  the transaction is rolled back.
- Route `check` (in `auth/routes.ts`): select the user, run `verifyTotp`, then
  `UPDATE users … last_totp_step < ?`, all on `conn`. It returns `{ userId, username }` or
  `null`. Unknown usernames still run a check, as today. `createSession` runs after
  `throttledAttempt` returns, once the connection has been released.
- Config: `COOKIE_SECURE: z.stringbool().optional()` and
  `cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production'`. The `Config` type is
  unchanged. Zod 4.6.5 was checked by running it: an absent value gives `undefined`;
  `'false'`/`'0'`/`'FALSE'` give `false`; `''` and other values are rejected, same as today.
- App: none. New dependencies: none.

## Slices

- [ ] 1. Count parallel wrong login codes against the limit
  - Files: `apps/api/src/auth/throttle.ts`, `apps/api/src/auth/routes.ts`,
    `apps/api/test/auth.int.test.ts`
  - Change: add `throttledAttempt` as specified in Contracts and delete the three old functions.
    The login handler uses the new function: `blocked`→429, `rejected`→401, `accepted`→session.
    The `user!` non-null assertions go away.
  - Tests (`auth.int.test.ts`, new cases only; existing cases untouched):
    - "counts parallel wrong codes": the wrong code is `codeAt() === '000000' ? '111111' : '000000'`.
      Every status is 401 or 429. `Promise.all` of 10 wrong-code logins for `ivanka` from the
      same IP gives exactly five 401 `invalid_credentials` and five 429 `blocked` (the AC allows
      ≤5 401s; serialisation makes it exactly 5). A correct code afterwards gets 429. Prove-It:
      on Base all 10 pass `anyLocked`, so the test fails there.
    - "clears the username count after a good login": 4 wrong codes, then a correct one, gives 200.
      The `login_throttle` row for `('username','ivanka')` has `failed_attempts = 0`, and the
      `('ip','203.0.113.7')` row still has `4`.
  - Est. ~120 changed lines.
- [ ] 2. Trust X-Forwarded-For only from the local nginx
  - Files: `apps/api/src/app.ts`, `apps/api/test/auth.int.test.ts`, `README.md`
  - Change: `trustProxy: 'loopback'` (127.0.0.0/8 and ::1), with a why-comment that mentions
    the fail-closed hop count. A short README "Deployment" note says nginx must append the client
    address (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` or `$remote_addr`).
  - Tests (`auth.int.test.ts`):
    - "throttles the address nginx appended": 5 wrong logins (`guess0..4`) with
      `remoteAddress: '127.0.0.1'` and `x-forwarded-for: '6.6.6.6, 203.0.113.9'`. Then the IP rows
      with `locked_until > clock` are exactly `['203.0.113.9']`, and no row exists for
      `6.6.6.6`. Fails on Base (`trustProxy: true` gives the left-most address).
    - Same test, continued, while 203.0.113.9 is locked, in this order. First, a correct code for
      `ivanka` from loopback with `x-forwarded-for: '1.2.3.4, 203.0.113.9'` gives 429. Then the
      correct code from `remoteAddress: '198.51.100.5'` with `x-forwarded-for: '203.0.113.9'`
      gives 200, because X-Forwarded-For is ignored when the peer isn't loopback; if it were
      trusted the answer would be 429.
  - Behaviour was confirmed with a scratch Fastify 5.12.5 inject: `'loopback'` resolves these
    cases to 203.0.113.9, 198.51.100.5 and 127.0.0.1; `1` resolves to 127.0.0.1; `true` resolves
    to 6.6.6.6.
  - Est. ~45 changed lines.
- [ ] 3. Make the session cookie Secure by default in production
  - Files: `apps/api/src/config.ts`, `apps/api/test/config.test.ts` (new),
    `apps/api/.env.example`, `README.md` (one line in the Deployment note: NODE_ENV=production makes the session cookie Secure; COOKIE_SECURE=false only for plain-HTTP serving)
  - Change: the config contract above. `.env.example` comment: "Defaults to true when
    NODE_ENV=production; set false only where the API is served over plain HTTP". The local
    `COOKIE_SECURE=false` line stays.
  - Tests (`config.test.ts`, table-style; pass an explicit `source` with `DATABASE_URL` and a
    32-byte base64 `TOTP_ENC_KEY`, so `test/setup.ts`'s `.env` load doesn't leak in):
    - production with COOKIE_SECURE unset gives `true`;
    - production with `'false'` gives `false`;
    - development with it unset gives `false`;
    - development with `'true'` gives `true`.
  - Est. ~45 changed lines.

Total ≈ 210 changed lines, 3 commits. Each commit passes `yarn format:check && yarn lint && yarn typecheck && yarn test`.

## AC → evidence

| AC                                                               | Evidence                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 10 parallel wrong codes → ≤5 × 401, rest 429; then correct → 429 | `auth.int.test.ts` "counts parallel wrong codes" (slice 1)                                                               |
| 4 wrong + correct → 200, username count 0                        | `auth.int.test.ts` "clears the username count after a good login" (slice 1)                                              |
| XFF `6.6.6.6, 203.0.113.9` from 127.0.0.1 → key `203.0.113.9`    | `auth.int.test.ts` "throttles the address nginx appended" (slice 2)                                                      |
| production + no COOKIE_SECURE → Secure; `false` turns it off     | `config.test.ts` cases (slice 3) + `.env.example` comment. The route already passes `config.cookieSecure` to `setCookie` |
| Existing auth integration tests unchanged                        | `git diff` shows only added `it(...)` blocks in `auth.int.test.ts`; full `yarn test` green with MySQL in every slice     |

## Not doing (YAGNI)

- No change to the limits, keys or lockout policy, and no CAPTCHA, backoff, alerting or admin unlock (out of scope).
- No `TRUST_PROXY` env var: there's one deploy shape (nginx on the same host).
- No deadlock-retry loop: the fixed lock order plus exclusive ODKU locks should avoid deadlocks. It
  gets added only if the slice 1 test shows `ER_LOCK_DEADLOCK`; that would be recorded under Deviations.
- No integration test that builds a second app with `cookieSecure: true`: the AC asks for a `loadConfig` unit test.
- nginx config itself, `requireAuth` move (A10), other auth refactors.

## Risks

- Deadlock or lock-wait timeouts under the parallel burst give 500s instead of 401/429. Slice 1's
  10-way `Promise.all` test proves or disproves it on MySQL 8.0 in CI (local test DB reports
  REPEATABLE-READ, lock wait 50 s).
- Pool starvation if `check` ever uses `db` instead of `conn`. The slice 1 test (10 parallel = pool
  limit) would hang and time out; the JSDoc on `throttledAttempt` says why.
- In production, while logins that share a key wait on each other's row locks, each one holds a
  pool connection. A burst of more than 10 makes other API requests wait for a connection, for up
  to the lock wait (50 s). This is acceptable for a two-user app and isn't tested; it's noted so the
  reviewer doesn't treat it as a surprise.
- Production may not set `NODE_ENV=production`. No deploy file in the repo sets it, so the new
  default wouldn't apply. This can't be proven in-repo; it's in Open questions.
- Production served over plain HTTP: a Secure cookie would break web login there. This can't be
  proven in-repo; the README/.env.example text says how to turn it off.

## Open questions

- Blocking: no. "An attempt counts … before its code is checked": this plan decides the count under
  row locks taken before the check, and doesn't count a _successful_ attempt against the IP. The
  brief says "as today" for success, and the IP count "only decays". Assumption: that is the intent.
  If successful logins should also add to the IP count, slice 1 becomes the reserve-first variant,
  and households would hit the IP lock after 5 logins per 24 h.
- Blocking: no. Does production set `NODE_ENV=production` (and serve HTTPS)? Assumption: yes. If not,
  the deploy should also set `COOKIE_SECURE=true` explicitly.

## Follow-ups

- Today's `recordFailure` uses `INSERT IGNORE` followed by `FOR UPDATE`, which can deadlock under
  concurrency (shared-to-exclusive upgrade). Slice 1 removes it as part of the fix; nothing else uses
  that pattern.
- `login_throttle` grows by one row per new IP/device on success too, because the row is created
  before the check and committed. Old rows are never pruned; that would be a separate cleanup.

## Deviations

<filled by the developer during build>

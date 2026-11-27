# Plan: Split throttledAttempt into its locking and recording steps

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/throttle-attempt-steps
Base: origin/main (ce168443)

## Approach

Two extract commits in `apps/api/src/auth/throttle.ts`, each moving one block of `throttledAttempt` verbatim (statements,
order and comments) into a file-private function. The function keeps the transaction (begin, blocked rollback, commit,
catch rollback, release). Today's tests don't cover either rollback, so a characterization slice that calls
`throttledAttempt` directly comes first.
Alternative considered: one commit for both extractions. Lost because two small commits are easier to review against the
lock-order invariant, and the brief's lock-order commit body belongs with the `lockStates` move.

## Contracts

- DB / API / App: none (same SQL, same order, same transaction; `throttledAttempt`'s signature and `Attempt<T>` unchanged)
- New, not exported: `lockStates(conn: PoolConnection, keys: ThrottleKey[]): Promise<ThrottleState[]>`: for each key in
  `keys` order, the ODKU upsert and then `SELECT … FOR UPDATE`. Returns one state per key, in `keys` order.
- New, not exported: `recordOutcome(conn: PoolConnection, keys: ThrottleKey[], states: ThrottleState[], value: { userId: number } | null, now: Date): Promise<void>`:
  for each key, `afterFailure` write (value null) or the `failed_attempts = 0` clear (non-ip), then the `known_devices`
  upsert (value non-null and a device key). Returns nothing.
- Reuses: `afterFailure`, `blocked` unchanged. New dependencies: none

## Version

Bump: patch — 1.26.3 → 1.26.5 (R2, brief 118, takes 1.26.4; re-bump on rebase if `main` moves)
Why: §8b "a refactor that touches shipped code is `patch`": slices 2–3 change `apps/api/src`, behaviour unchanged.

## Slices

Coverage today (all unmodified): lock loop: every login case in `auth.int.test.ts`, with serialization in "counts
parallel wrong codes". Failure write: "blocks the username for 24 h after 5 wrong codes", "blocks a device id across
usernames and IPs", "counts a known device's wrong codes against the username". Clear (non-ip): "clears the username
count after a good login" (username 0, ip 4). Known-device upsert: "remembers a device's first and last successful
login", "remembers no device for a login without a device id", "remembers devices for parallel logins". **Thin:** the
blocked-path rollback and the rollback when `check` throws. No test sees either one.

- [ ] 0. Bump version to 1.26.5
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.5
- [ ] 1. Pin that a throttled attempt rolls back when blocked or when its check throws (~35 lines)
  - Files: apps/api/test/throttle.int.test.ts (add `vi` to the vitest import and a second top-level
    `describe.skipIf(…)('throttledAttempt (MySQL)')` with its own `resetSchema`/`createDb`/`clearData`, reusing the
    module's `now` and `ahead`)
  - Cases: "rolls back the rows it added and skips the check when a key is locked": seed one row,
    `('username', 'ivanka', 0, now, ahead(HOUR))`. Keys `username ivanka` and `ip 192.0.2.1`, `check = vi.fn()`. Expect `{ outcome: 'blocked' }`, `check`
    not called, and rows `[['username', 'ivanka', 0]]` (no ip row). "rolls back and rethrows when the check throws": no
    seed, same keys, and `check` runs `UPDATE login_throttle SET failed_attempts = 3` on `conn` and then throws `failure`.
    Expect `rejects.toBe(failure)` and rows `[]`.
  - Both cases also spy on the attempt's connection (`vi.spyOn(db, 'getConnection')` wrapping the real one) and expect
    `rollback` called once and `commit` never, so the pin doesn't rest on which pooled connection the rows read gets.
    The new describe inlines its own one-row INSERT and rows read; the pruneThrottle describe stays untouched.
  - Proof: passes on Base. Bite check by hand: delete each `conn.rollback()` and watch its case fail, then restore.
    The rows read lands in the same session because the describe's pool opens one connection (tests run in sequence,
    `resetOnRelease` off), so it also sees uncommitted rows.
- [ ] 2. Extract the per-key row locking from throttledAttempt
  - Files: apps/api/src/auth/throttle.ts
  - Change: move lines 85–105 (the loop and its two comments) into `lockStates`. The call becomes
    `const states = await lockStates(conn, keys);`. One-line JSDoc. Commit body: the lock order (username, ip, device =
    the ENUM index order = ascending primary key) is the deadlock invariant shared with other attempts and with
    `pruneThrottle`'s DELETE, so the loop moves unchanged.
  - Proof: slice 1 cases; `auth.int.test.ts` "counts parallel wrong codes", "remembers devices for parallel logins",
    "blocks the username for 24 h after 5 wrong codes"; `throttle.int.test.ts` pruneThrottle case.
- [ ] 3. Extract the outcome writes from throttledAttempt
  - Files: apps/api/src/auth/throttle.ts
  - Change: move lines 112–136 (the per-key writes, the ip comment, the device upsert) into `recordOutcome`. The call
    `await recordOutcome(conn, keys, states, value, now);` goes between `check` and `commit`. `throttledAttempt` ends
    ~25 lines long and 3 levels deep (function → try → if).
  - Proof: slice 1 cases; `auth.int.test.ts` "clears the username count after a good login", "counts a known device's
    wrong codes against the username", "remembers a device's first and last successful login", "remembers no device for
    a login without a device id", "lets a known device log in while its username is locked".
- [ ] 4. Mark R3 in review in the backlog
  - Files: docs/features/BACKLOG.md (Refactor roadmap table: R3 → brief `119`, state `in review`), this plan's ticks

Every slice: gates (§7) and `find-short-names.sh --diff origin/main` clean.

## AC → evidence

| AC                                       | Evidence                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| calls both steps, ≤ ~35 lines, ≤ 3 deep  | slice 3 diff; reviewer counts lines/levels                             |
| same lock order, same queries, same txn  | verbatim moves in slices 2–3; parallel cases + slice 1 rollback cases  |
| commit body explains the lock order      | slice 2 commit body                                                    |
| `find-short-names.sh --diff origin/main` | run after each slice                                                   |
| behaviour unchanged, tests unmodified    | `yarn test`: API 548 passed (546 + 2 new), 2 skipped; MCP 327; app 510 |
| patch bump in both files                 | slice 0                                                                |

## Not doing (YAGNI)

- `withTransaction`, `blocked`, `afterFailure`, `pruneThrottle` (out of scope); a device-count-clear test (it shares the
  `key.type !== 'ip'` branch that "clears the username count" pins).

## Risks

- R2's PR edits the R2 row next to R3 in BACKLOG.md and the version. Rebase conflict in slices 0/4: take main, re-apply.
- Slice 1's rows check relies on the pool reusing the connection it just released. The slice 1 bite check proves this.

## Open questions

- no — none.

## Follow-ups

## Deviations

## Consolidate

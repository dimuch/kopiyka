# Split throttledAttempt into its locking and recording steps

Type: chore

## Why

Roadmap row R3 (`docs/features/refactor-roadmap-2026-11.md`). `throttledAttempt` in `apps/api/src/auth/throttle.ts`
is about 70 lines and four levels deep: it opens a transaction, locks and reads a throttle row per key, checks for a
block, runs the caller's check, then writes the outcome per key and remembers the device. The transaction shape is
hard to see through the detail.

## What

Extract, in the same file, keeping statement order:

- `lockStates(conn, keys)`: the per-key upsert and `SELECT … FOR UPDATE` loop, returning the states;
- `recordOutcome(conn, keys, states, value, now)`: the per-key failure/clear writes and the known-device upsert.

`throttledAttempt` keeps the transaction (begin, rollback on the blocked path, commit, rollback on error, release)
and calls the two steps. The lock order (username, ip, device; ascending primary key) is a deadlock invariant: this is
a pure extraction, and the commit body says why the order is kept.

## Acceptance criteria

- [ ] `auth/throttle.ts`: `throttledAttempt` calls `lockStates` and `recordOutcome`, is ≤ ~35 lines and ≤ 3 levels deep
- [ ] The rows are locked in the same key order, and every query runs in the same order in the same transaction
- [ ] The commit body explains why the lock order is kept
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified; API responses, error codes and SQL effects are the same
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed error codes.
- Replacing the manual transaction with `withTransaction` (it rolls back on the blocked path; left alone on purpose).
- `blocked`, `afterFailure`, `pruneThrottle`.

## Notes

Covered by: auth.int (23), throttle.int, throttle.test. Base `origin/main` after R1 (#189): gates green, API 546
passed + 2 skipped (integration ran), MCP 327, app 510. R2 (brief 118, in flight) takes 1.26.4, so this PR is
1.26.5 (re-bumped on rebase if needed).

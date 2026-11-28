# Outcome: Split throttledAttempt into its locking and recording steps

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#191](https://github.com/dimuch/kopiyka/pull/191) Split throttledAttempt into its locking and recording steps — v1.26.5

## Decided

- Roadmap row R3. Two extract commits in `auth/throttle.ts`: the per-key row locking, then the outcome writes, each
  moved verbatim into a file-private function. `throttledAttempt` kept the transaction (begin, rollbacks, commit,
  release).
- No test covered either rollback, so a characterization slice calling `throttledAttempt` directly came first.
- Two commits instead of one, so each is easy to check against the lock-order rule; the lock-order note sits on the
  locking commit.

## Left out

- `withTransaction`, `blocked`, `afterFailure` and `pruneThrottle` (out of scope).
- A device-count clear test: it shares the branch the username-count test already pins.

## Follow-ups

None.

Full plan: `git show 04d13aea:docs/features/119-throttle-attempt-steps/plan.md`
